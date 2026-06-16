import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/google/gmail'
import { GoogleAuthError } from '@/lib/google/oauth'
import { emailSendRateLimit } from '@/lib/rate-limit'
import { canTransition, type DealStage } from '@/lib/stage-machine'
import { formatNameFromEmail } from '@/lib/utils'
import { lookupNamesByEmail } from '@/lib/google/people'

/**
 * GET /api/campaigns/[id]/send-emails?status=results
 *   → returns last send results for this campaign
 * GET /api/campaigns/[id]/send-emails?status=progress&jobId=...
 *   → returns progress for in-flight job
 *
 * POST /api/campaigns/[id]/send-emails
 *   → sends campaign template emails to all eligible leads
 */

// ── Helpers ────────────────────────────────────────────────────────────────

type DealFieldRow = { value: string | null; field_definitions: { key: string; label: string; data_type: string } | null }

function getDealName(dealFields: DealFieldRow[]): string {
  const nameField = dealFields.find((df) => df.field_definitions?.key === 'address')
  return nameField?.value || 'Untitled Deal'
}

// ── Resolve merge fields in a template string ─────────────────────────────

function resolveTemplate(
  template: string,
  deal: { deal_fields: { value: string | null; field_definitions: { key: string; label: string; data_type: string } | null }[] },
  contact: { name?: string | null; email?: string[] | null; phone_cell?: string | null; phone_office?: string | null; company?: string | null } | null,
  campaignName: string,
  senderEmail: string,
): string {
  let result = template

  // Deal fields
  for (const df of deal.deal_fields) {
    const key = df.field_definitions?.key
    if (key) result = result.replaceAll(`{${key}}`, df.value ?? '')
  }

  // Fallback for legacy {deal_name} -> mapped to address field value
  const addressField = deal.deal_fields.find((f) => f.field_definitions?.key === 'address')
  if (addressField) {
    result = result.replaceAll('{deal_name}', addressField.value ?? '')
  }

  // Contact fields
  if (contact) {
    result = result.replaceAll('{contact_name}', contact.name ?? '')
    result = result.replaceAll('{contact_email}', contact.email?.[0] ?? '')
    const phone = contact.phone_cell ?? contact.phone_office ?? ''
    result = result.replaceAll('{contact_phone}', phone)
    result = result.replaceAll('{contact_company}', contact.company ?? '')
  }

  // Campaign / sender
  result = result.replaceAll('{campaign_name}', campaignName)
  result = result.replaceAll('{sender_name}', senderEmail)

  return result
}

// ── In-memory job store (sessions only, acceptable for mass-email batches) ─

type JobResult = { dealId: string; dealName: string; recipient: string; success: boolean; error?: string }

const jobs = new Map<string, {
  campaignId: string
  total: number
  sent: number
  results: JobResult[]
  stillProcessing: boolean
}>()

function cleanupJob(jobId: string) {
  // Keep results for 5 min after completion
  setTimeout(() => jobs.delete(jobId), 300_000)
}

// ── GET handler ────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: campaignId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const status = req.nextUrl.searchParams.get('status')
  const jobId = req.nextUrl.searchParams.get('jobId')

  if (status === 'results' || status === 'progress') {
    // Return results for the most recent job for this campaign
    let targetJob: { campaignId: string; total: number; sent: number; results: JobResult[]; stillProcessing: boolean } | undefined

    if (jobId) {
      targetJob = jobs.get(jobId)
    } else {
      // Find latest job for this campaign
      for (const [, job] of [...jobs.entries()].reverse()) {
        if (job.campaignId === campaignId) { targetJob = job; break }
      }
    }

    if (!targetJob) {
      return NextResponse.json({ results: [], total: 0, sent: 0, stillProcessing: false })
    }

    return NextResponse.json({
      results: targetJob.results,
      total: targetJob.total,
      sent: targetJob.sent,
      stillProcessing: targetJob.stillProcessing,
    })
  }

  return NextResponse.json({ error: 'Invalid status param' }, { status: 400 })
}

// ── POST handler ───────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: campaignId } = await params
  let jobResults: JobResult[] = []

  try {
    if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
      return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Per-user rate limit on campaign email sends
    const { success: rateLimitOk } = await emailSendRateLimit.limit(user.id)
    if (!rateLimitOk) {
      return NextResponse.json(
        { error: 'Daily email send limit reached. Try again tomorrow.' },
        { status: 429 },
      )
    }

    const body = await req.json().catch(() => ({}))
    const projectId = body.projectId as string | undefined

    // Fetch campaign
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    // Template required: either built-in (email_template enum) OR custom (email_template_id)
    const hasTemplate = !!campaign.email_template || !!campaign.email_template_id
    if (!hasTemplate) {
      return NextResponse.json({ error: 'No email template selected for this campaign' }, { status: 400 })
    }

    // Validate that template content is available
    const subjectTemplate = campaign.email_subject_template as string | null
    const bodyTemplate = campaign.email_body_template as string | null
    if (!subjectTemplate && !bodyTemplate) {
      return NextResponse.json({ error: 'Email template has no subject or body content' }, { status: 400 })
    }

    // Resolve Gmail connection
    let connectionId: string | null = null
    if (projectId) {
      const { data: project } = await supabase
        .from('projects')
        .select('google_connection_id')
        .eq('id', projectId)
        .single()
      connectionId = project?.google_connection_id ?? null
    }
    if (!connectionId) {
      return NextResponse.json({ error: 'Project not connected to Gmail' }, { status: 400 })
    }

    // Fetch deals in campaign with contacts (stage = 'lead', not already emailed)
    // Note: deal_name was dropped from deals in migration 0024 — it lives in deal_fields now
    const { data: deals, error: dealsQueryError } = await supabase
      .from('deals')
      .select(`
        id, stage, outreach_emails,
        contacts(id, name, company, email, phone_office, phone_cell, is_primary),
        deal_fields(value, field_definitions(key, label, data_type))
      `)
      .eq('campaign_id', campaignId)
      .eq('stage', 'lead')

    if (dealsQueryError) {
      console.error('[send-emails] deals query error:', dealsQueryError)
      return NextResponse.json({
        error: 'Failed to query deals',
        detail: dealsQueryError.message || String(dealsQueryError),
        total: 0,
        sent: 0,
      }, { status: 200 })
    }

    if (!deals?.length) {
      // Diagnostics: query all deals in this campaign and show stage distribution
      const { data: allDeals, error: allDealsError } = await supabase
        .from('deals')
        .select('id, stage, campaign_id')
        .eq('campaign_id', campaignId)

      const stageCounts: Record<string, number> = {}
      const campaignIds = new Set<string>()
      if (allDeals) {
        for (const d of allDeals) {
          const s = (d as Record<string, unknown>).stage as string ?? 'null'
          stageCounts[s] = (stageCounts[s] ?? 0) + 1
          campaignIds.add((d as Record<string, unknown>).campaign_id as string)
        }
      }

      const distribution = Object.entries(stageCounts)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ') || 'none'

      return NextResponse.json({
        error: 'No leads to send to in this campaign',
        detail: `Campaign ${campaignId} has ${allDeals?.length ?? 0} deal(s). Stage distribution: ${distribution}.${allDealsError ? ` Query error: ${allDealsError.message}` : ''}`,
        total: 0,
        sent: 0,
      }, { status: 200 })
    }

    // Filter: must have at least one contact email or outreach_emails
    // Note: no longer blocks previously-sent deals — per-email dedup handles re-sends
    const eligible = deals.filter((d) => {
      const contacts = (d.contacts as unknown[]) ?? []
      const hasContactEmail = contacts.some((c: unknown) => {
        const emails = (c as { email?: string[] | null }).email
        return emails && emails.length > 0
      })
      const hasOutreachEmails =
        (d as Record<string, unknown>).outreach_emails != null &&
        Array.isArray((d as Record<string, unknown>).outreach_emails) &&
        ((d as Record<string, unknown>).outreach_emails as unknown[]).length > 0
      return hasContactEmail || hasOutreachEmails
    })

    if (eligible.length === 0) {
      const totalFetched = deals?.length ?? 0
      const withContactEmail = deals?.filter((d) => {
        const contacts = (d.contacts as unknown[]) ?? []
        return contacts.some((c: unknown) => {
          const emails = (c as { email?: string[] | null }).email
          return emails && emails.length > 0
        })
      }).length ?? 0
      const withOutreachEmails = deals?.filter((d) => {
        const oe = (d as Record<string, unknown>).outreach_emails
        return oe != null && Array.isArray(oe) && oe.length > 0
      }).length ?? 0

      return NextResponse.json({
        error: 'No eligible leads found',
        detail: `${totalFetched} lead(s) fetched. ${withContactEmail} with contact email, ${withOutreachEmails} with outreach emails.`,
        total: 0,
        sent: 0,
      }, { status: 200 })
    }

    // Create or resume job
    const existingJobId = body.jobId as string | undefined
    const jobId = existingJobId ?? crypto.randomUUID()
    jobResults = []
    const previousSent = existingJobId ? (jobs.get(existingJobId)?.sent ?? 0) : 0

    jobs.set(jobId, {
      campaignId,
      total: 0, // will update after counting
      sent: previousSent,
      results: jobResults,
      stillProcessing: true,
    })

    // Count total unique emails across all eligible deals for progress tracking
    let totalEmailCount = 0
    for (const deal of eligible) {
      const emailSet = new Set<string>()
      const dcontacts = (deal.contacts as Array<{ email?: string[] | null }>) ?? []
      for (const c of dcontacts) {
        for (const e of c.email ?? []) { if (e) emailSet.add(e.toLowerCase()) }
      }
      const oe = (deal as Record<string, unknown>).outreach_emails as string[] | undefined
      for (const e of oe ?? []) { if (e) emailSet.add(e.toLowerCase()) }
      totalEmailCount += emailSet.size
    }

    const jobTotal = totalEmailCount + previousSent
    const job = jobs.get(jobId)!
    job.total = jobTotal

    const senderEmail = user.email ?? 'team@acquire.com'

    // Pre-fetch display names from Gmail People API for all recipient emails
    let nameMap = new Map<string, string>()
    try {
      const allEmails: string[] = []
      for (const deal of eligible) {
        const dcontacts = (deal.contacts as Array<{ email?: string[] | null }>) ?? []
        for (const c of dcontacts) {
          for (const e of c.email ?? []) { if (e) allEmails.push(e) }
        }
        const oe = (deal as Record<string, unknown>).outreach_emails as string[] | undefined
        for (const e of oe ?? []) { if (e) allEmails.push(e) }
      }
      nameMap = await lookupNamesByEmail(connectionId, allEmails)
    } catch { /* non-fatal — fall back to formatNameFromEmail */ }

    const startTime = Date.now()
    const TIMEOUT_MS = 45_000
    type ContactRow = { id: string; name: string | null; company: string | null; email: string[] | null; phone_office: string | null; phone_cell: string | null; is_primary: boolean | null }

    let emailsSent = 0
    for (let i = 0; i < eligible.length; i++) {
      if (Date.now() - startTime > TIMEOUT_MS) {
        job.sent = previousSent + emailsSent
        job.stillProcessing = true
        return NextResponse.json({
          jobId,
          total: jobTotal,
          sent: job.sent,
          stillProcessing: true,
        })
      }

      const deal = eligible[i]!
      const dealName = getDealName((deal.deal_fields as unknown as DealFieldRow[]) ?? [])
      const contacts = (deal.contacts as unknown as ContactRow[]) ?? []

      // Collect all unique emails for this deal
      const uniqueEmails = new Set<string>()
      for (const c of contacts) {
        for (const e of c.email ?? []) { if (e) uniqueEmails.add(e.toLowerCase()) }
      }
      const outreachEmails = (deal as Record<string, unknown>).outreach_emails as string[] | undefined
      for (const e of outreachEmails ?? []) { if (e) uniqueEmails.add(e.toLowerCase()) }

      if (uniqueEmails.size === 0) {
        jobResults.push({ dealId: deal.id, dealName, recipient: '', success: false, error: 'No email addresses' })
        emailsSent++
        continue
      }

      const dealFields = (deal.deal_fields as unknown as DealFieldRow[]) ?? []
      let dealHadSuccess = false

      for (const recipientEmail of uniqueEmails) {
        const matchingContact = contacts.find((c) =>
          (c.email ?? []).some((e: string) => e.toLowerCase() === recipientEmail),
        )
        const contactId: string | null = matchingContact?.id ?? null

        const contactForTemplate = matchingContact ?? {
          name: nameMap.get(recipientEmail.toLowerCase()) ?? formatNameFromEmail(recipientEmail),
          email: [recipientEmail],
          phone_cell: null,
          phone_office: null,
          company: null,
        }

        try {
          const subject = resolveTemplate(
            subjectTemplate ?? '{property_address} — Investment Opportunity',
            { deal_fields: dealFields },
            contactForTemplate,
            campaign.name,
            senderEmail,
          )

          const bodyText = resolveTemplate(
            bodyTemplate ?? '',
            { deal_fields: dealFields },
            contactForTemplate,
            campaign.name,
            senderEmail,
          )

          const htmlBody = `
            <html><body style="font-family:Arial,sans-serif;color:#1e293b;padding:16px 0">
              <div style="white-space:pre-wrap">${bodyText.replaceAll('\n', '<br>')}</div>
            </body></html>`

          const result = await sendEmail(connectionId, recipientEmail, subject, htmlBody)

          const templateUsed = (campaign.email_template as string) || 'custom'
          await supabase.from('email_outreach').insert({
            deal_id: deal.id,
            contact_id: contactId,
            status: 'sent',
            sent_at: new Date().toISOString(),
            subject,
            template_used: templateUsed,
            gmail_message_id: result.messageId,
            gmail_thread_id: result.threadId,
          })

          jobResults.push({ dealId: deal.id, dealName, recipient: recipientEmail, success: true })
          dealHadSuccess = true

          await new Promise((r) => setTimeout(r, 300))
        } catch (err) {
          if (err instanceof GoogleAuthError && err.code === 'invalid_grant') {
            // Stop sending — auth expired. Return partial results + auth error.
            return NextResponse.json({
              results: jobResults,
              error: 'google_auth_expired',
              message: 'Google authentication expired. Please reconnect in Settings.',
            }, { status: 401 })
          }
          const message = err instanceof Error ? err.message : 'Unknown error'
          jobResults.push({ dealId: deal.id, dealName, recipient: recipientEmail, success: false, error: message })

          if (message.includes('not found') || message.includes('invalid')) {
            await supabase.from('email_outreach').insert({
              deal_id: deal.id,
              contact_id: contactId,
              status: message.includes('not found') ? 'invalid_address' : 'gmail_error',
              error_message: message,
              template_used: (campaign.email_template as string) || 'custom',
            })
          }
        }
        emailsSent++
      }

      // Transition deal stage if at least one email succeeded
      if (dealHadSuccess) {
        const transition = canTransition('lead' as DealStage, 'outreach' as DealStage)
        if (transition.ok) {
          await supabase.from('deals').update({
            stage: 'outreach',
            last_email_sent_on: new Date().toISOString(),
          }).eq('id', deal.id)
        } else {
          // Still update last_email_sent_on even if stage transition is blocked
          await supabase.from('deals').update({ last_email_sent_on: new Date().toISOString() }).eq('id', deal.id)
        }
      }
    }

    // All done
    job.sent = previousSent + emailsSent
    job.stillProcessing = false
    cleanupJob(jobId)

    return NextResponse.json({
      jobId,
      total: jobTotal,
      sent: job.sent,
      stillProcessing: false,
      results: jobResults,
    })
  } catch (err) {
    if (err instanceof GoogleAuthError && err.code === 'invalid_grant') {
      return NextResponse.json({
        results: jobResults,
        error: 'google_auth_expired',
        message: 'Google authentication expired. Please reconnect in Settings.',
      }, { status: 401 })
    }
    console.error('Campaign send-emails error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
