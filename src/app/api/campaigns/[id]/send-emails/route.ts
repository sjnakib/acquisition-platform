import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/google/gmail'
import { canTransition, type DealStage } from '@/lib/stage-machine'

/**
 * GET /api/campaigns/[id]/send-emails?status=results
 *   → returns last send results for this campaign
 * GET /api/campaigns/[id]/send-emails?status=progress&jobId=...
 *   → returns progress for in-flight job
 *
 * POST /api/campaigns/[id]/send-emails
 *   → sends campaign template emails to all eligible leads
 */

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

const jobs = new Map<string, {
  campaignId: string
  total: number
  sent: number
  results: { dealId: string; dealName: string; success: boolean; error?: string }[]
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
    let targetJob: { campaignId: string; total: number; sent: number; results: { dealId: string; dealName: string; success: boolean; error?: string }[]; stillProcessing: boolean } | undefined

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

  try {
    if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
      return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const projectId = body.projectId as string | undefined

    // Fetch campaign
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    if (!campaign.email_template) {
      return NextResponse.json({ error: 'No email template selected for this campaign' }, { status: 400 })
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
    const { data: deals } = await supabase
      .from('deals')
      .select(`
        id, deal_name, stage,
        contacts(id, name, company, email, phone_office, phone_cell, is_primary),
        deal_fields(value, field_definitions(key, label, data_type)),
        email_outreach(id, status)
      `)
      .eq('campaign_id', campaignId)
      .eq('stage', 'lead')

    if (!deals?.length) {
      return NextResponse.json({ error: 'No leads to send to in this campaign', total: 0, sent: 0 }, { status: 200 })
    }

    // Filter: must have at least one contact with email, must not have already been sent
    const eligible = deals.filter((d) => {
      const contacts = (d.contacts as unknown[]) ?? []
      const hasEmail = contacts.some((c: unknown) => {
        const emails = (c as { email?: string[] | null }).email
        return emails && emails.length > 0
      })
      const alreadySent = ((d.email_outreach as unknown[]) ?? []).some(
        (e: unknown) => (e as { status: string }).status === 'sent',
      )
      return hasEmail && !alreadySent
    })

    if (eligible.length === 0) {
      return NextResponse.json({ error: 'All leads have already been emailed or have no contact email', total: 0, sent: 0 }, { status: 200 })
    }

    // Create job
    const jobId = crypto.randomUUID()
    const jobResults: { dealId: string; dealName: string; success: boolean; error?: string }[] = []

    jobs.set(jobId, {
      campaignId,
      total: eligible.length,
      sent: 0,
      results: jobResults,
      stillProcessing: true,
    })

    // Process sends (each iteration doesn't await so it runs in background)
    const senderEmail = user.email ?? 'team@acquire.com'

    // We process synchronously to respect rate limits, but return after first batch
    // to avoid Vercel timeout. Client polls for remaining.
    const startTime = Date.now()
    const TIMEOUT_MS = 45_000 // return before Vercel 60s limit

    for (let i = 0; i < eligible.length; i++) {
      if (Date.now() - startTime > TIMEOUT_MS) {
        // Return partial — client should retry
        const job = jobs.get(jobId)
        if (job) {
          job.sent = i
          job.stillProcessing = true
        }

        return NextResponse.json({
          jobId,
          total: eligible.length,
          sent: i,
          stillProcessing: true,
          message: `Processed ${i} of ${eligible.length}. Retry to send remaining.`,
        })
      }

      const deal = eligible[i]!
      const contacts = (deal.contacts as Array<{ id: string; name: string | null; company: string | null; email: string[] | null; phone_office: string | null; phone_cell: string | null; is_primary: boolean | null }>) ?? []

      // Pick primary contact, or first with email
      const primaryContact = contacts.find((c) => c.is_primary) ?? contacts.find((c) => c.email?.length)
      if (!primaryContact?.email?.[0]) {
        jobResults.push({ dealId: deal.id, dealName: deal.deal_name ?? 'Untitled Deal', success: false, error: 'No contact email' })
        continue
      }

      try {
        type DealFieldRow = { value: string | null; field_definitions: { key: string; label: string; data_type: string } | null }
        const dealFields = (deal.deal_fields as unknown as DealFieldRow[]) ?? []

        const subject = resolveTemplate(
          campaign.email_subject_template ?? '{property_address} — Investment Opportunity',
          { deal_fields: dealFields },
          primaryContact,
          campaign.name,
          senderEmail,
        )

        const bodyText = resolveTemplate(
          campaign.email_body_template ?? '',
          { deal_fields: dealFields },
          primaryContact,
          campaign.name,
          senderEmail,
        )

        // Build simple HTML email from body text
        const htmlBody = `
          <html><body style="font-family:Arial,sans-serif;color:#1e293b;max-width:600px;margin:0 auto;padding:24px">
            <div style="white-space:pre-wrap">${bodyText.replaceAll('\n', '<br>')}</div>
          </body></html>`

        const result = await sendEmail(connectionId, primaryContact.email[0], subject, htmlBody)

        // Insert email_outreach record
        await supabase.from('email_outreach').insert({
          deal_id: deal.id,
          contact_id: primaryContact.id,
          status: 'sent',
          sent_at: new Date().toISOString(),
          subject,
          template_used: campaign.email_template as 'outreach' | 'thank_you' | 'declination',
          gmail_message_id: result.messageId,
          gmail_thread_id: result.threadId,
        })

        // Transition deal stage lead → outreach
        const transition = canTransition('lead' as DealStage, 'outreach' as DealStage)
        if (transition.ok) {
          await supabase.from('deals').update({ stage: 'outreach' }).eq('id', deal.id)
        }

        jobResults.push({ dealId: deal.id, dealName: deal.deal_name ?? 'Untitled Deal', success: true })

        // Small delay between sends to avoid Gmail rate limiting
        await new Promise((r) => setTimeout(r, 300))
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        jobResults.push({ dealId: deal.id, dealName: deal.deal_name ?? 'Untitled Deal', success: false, error: message })

        // On Gmail errors that aren't transient, don't stop the batch
        if (message.includes('not found') || message.includes('invalid')) {
          await supabase.from('email_outreach').insert({
            deal_id: deal.id,
            contact_id: primaryContact.id,
            status: message.includes('not found') ? 'invalid_address' : 'gmail_error',
            error_message: message,
            template_used: campaign.email_template as 'outreach' | 'thank_you' | 'declination',
          })
        }
      }
    }

    // All done
    const job = jobs.get(jobId)
    if (job) {
      job.sent = eligible.length
      job.stillProcessing = false
      cleanupJob(jobId)
    }

    return NextResponse.json({
      jobId,
      total: eligible.length,
      sent: eligible.length,
      stillProcessing: false,
      results: jobResults,
    })
  } catch (err) {
    console.error('Campaign send-emails error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
