import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthedClientByConnection } from '@/lib/google/oauth'
import { google } from 'googleapis'

interface DealField {
  value: string | null
  field_definitions: { key: string } | null
}

interface OutreachRow {
  id: string
  deal_id: string
  contact_id: string | null
  status: string
  sent_at: string | null
  subject: string | null
  gmail_thread_id: string | null
  gmail_message_id: string | null
  response_classification: string | null
  responded_at: string | null
  contacts: { name: string | null; email: string[] | null } | null
}

interface ThreadResult {
  threadId: string
  subject: string | null
  snippet: string | null
  dealName: string | null
  dealId: string
  contactName: string | null
  contactEmail: string | null
  status: string
  lastDate: string | null
  responseClassification: string | null
  messageCount: number
  isUnread: boolean
  isInbox: boolean
  snoozedUntil: string | null
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: campaignId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = user.app_metadata?.role
    if (role !== 'internal') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const folder = req.nextUrl.searchParams.get('folder') ?? 'inbox'

    // ── 1. Fetch campaign → get project_id ──────────────────────────
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, project_id')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (!campaign.project_id) {
      return NextResponse.json({ error: 'Campaign must be associated with a project to view emails.' }, { status: 400 })
    }

    const projectId = campaign.project_id

    // ── 2. Self-healing unsnooze check ──────────────────────────────
    try {
      const { data: expiredSnoozes } = await supabase
        .from('snoozed_threads')
        .select('id, thread_id, project_id')
        .eq('project_id', projectId)
        .lt('snoozed_until', new Date().toISOString())

      if (expiredSnoozes && expiredSnoozes.length > 0) {
        const { data: project } = await supabase
          .from('projects')
          .select('google_connection_id')
          .eq('id', projectId)
          .single()

        const connId = project?.google_connection_id
        if (connId) {
          const auth = await getAuthedClientByConnection(connId, { useAdminClient: true })
          const gmailClient = google.gmail({ version: 'v1', auth })
          for (const snooze of expiredSnoozes) {
            try {
              await gmailClient.users.threads.modify({
                userId: 'me',
                id: snooze.thread_id,
                requestBody: { addLabelIds: ['INBOX'] },
              })
            } catch (err) {
              console.error(`[campaign-emails] Failed to restore thread ${snooze.thread_id}:`, err)
            }
            await supabase.from('snoozed_threads').delete().eq('id', snooze.id)
          }
        }
      }
    } catch (snoozeErr) {
      console.error('[campaign-emails] Snooze expiration processing failed:', snoozeErr)
    }

    // ── 3. Fetch all deals in campaign with deal_fields ─────────────
    const { data: deals, error: dealsError } = await supabase
      .from('deals')
      .select('id, deal_fields(value, field_definitions(key))')
      .eq('campaign_id', campaignId)

    if (dealsError) {
      return NextResponse.json({ error: dealsError.message }, { status: 500 })
    }

    if (!deals || deals.length === 0) {
      return NextResponse.json({ threads: [], gmailConnected: false })
    }

    const dealIds = deals.map((d) => d.id)

    // Build address map for deal names
    const addressMap = new Map<string, string>()
    for (const deal of deals) {
      const fields = (deal.deal_fields as unknown as DealField[]) ?? []
      const addr = fields.find((f) => f?.field_definitions?.key === 'address')
      addressMap.set(deal.id, addr?.value ?? 'Property')
    }

    // ── 4. Fetch all email_outreach rows for these deals ────────────
    const { data: emails, error: emailsError } = await supabase
      .from('email_outreach')
      .select(`
        id, deal_id, contact_id, status, sent_at, subject,
        gmail_thread_id, gmail_message_id, response_classification, responded_at,
        contacts(name, email)
      `)
      .in('deal_id', dealIds)
      .order('sent_at', { ascending: false })

    if (emailsError) {
      return NextResponse.json({ error: emailsError.message }, { status: 500 })
    }

    const outreachMap = new Map<string, OutreachRow>()
    for (const e of (emails as unknown as OutreachRow[]) ?? []) {
      const tid = e.gmail_thread_id ?? e.id
      if (!outreachMap.has(tid)) {
        outreachMap.set(tid, e)
      }
    }

    // ── 5. Fetch contacts across all campaign deals ─────────────────
    const { data: contacts } = await supabase
      .from('contacts')
      .select('email')
      .in('deal_id', dealIds)

    const trackedEmails = contacts?.flatMap((c) => c.email ?? []).filter((e) => e.length > 0) ?? []

    // ── 6. Fetch active snoozed threads ─────────────────────────────
    const { data: activeSnoozedRows } = await supabase
      .from('snoozed_threads')
      .select('thread_id, snoozed_until, deal_id')
      .in('deal_id', dealIds)

    const snoozedMap = new Map<string, { until: string; dealId: string }>(
      activeSnoozedRows?.map((r) => [r.thread_id, { until: r.snoozed_until, dealId: r.deal_id }]) ?? []
    )

    // ── 7. Resolve Google connection ────────────────────────────────
    const { data: project } = await supabase
      .from('projects')
      .select('google_connection_id')
      .eq('id', projectId)
      .single()

    const connectionId = project?.google_connection_id ?? null

    if (!connectionId || trackedEmails.length === 0) {
      return NextResponse.json({ threads: [], gmailConnected: !!connectionId })
    }

    // ── 8. Query Gmail ──────────────────────────────────────────────
    const threads: Record<string, ThreadResult> = {}

    try {
      const auth = await getAuthedClientByConnection(connectionId, { useAdminClient: true })
      const gmail = google.gmail({ version: 'v1', auth })

      const terms = trackedEmails.flatMap((email) => [`from:${email}`, `to:${email}`])
      const baseQuery = terms.join(' OR ')
      let query = ''

      if (folder === 'inbox') {
        query = `(${baseQuery}) label:INBOX`
      } else if (folder === 'archived') {
        query = `(${baseQuery}) -label:INBOX -label:TRASH -label:SPAM`
      } else if (folder === 'snoozed') {
        const snoozedIds = Array.from(snoozedMap.keys())
        if (snoozedIds.length === 0) {
          return NextResponse.json({ threads: [], gmailConnected: true })
        }
        query = snoozedIds.map((tid) => `id:${tid}`).join(' OR ')
      }

      const listRes = await gmail.users.threads.list({ userId: 'me', q: query, maxResults: 50 })
      const gmailThreads = listRes.data.threads ?? []

      if (gmailThreads.length > 0) {
        const details = await Promise.allSettled(
          gmailThreads.map((gt) =>
            gmail.users.threads.get({
              userId: 'me',
              id: gt.id!,
              format: 'metadata',
              metadataHeaders: ['Date', 'Subject', 'From', 'To'],
            })
          )
        )

        details.forEach((result, i) => {
          const gt = gmailThreads[i]!
          const tid = gt.id!
          if (result.status !== 'fulfilled') return
          const t = result.value.data
          const messagesList = t.messages ?? []
          const firstMsg = messagesList[0]
          const lastMsg = messagesList[messagesList.length - 1] ?? firstMsg

          const firstHeaders: Record<string, string> = {}
          for (const h of firstMsg?.payload?.headers ?? []) {
            if (h.name) firstHeaders[h.name.toLowerCase()] = h.value ?? ''
          }
          const lastHeaders: Record<string, string> = {}
          for (const h of lastMsg?.payload?.headers ?? []) {
            if (h.name) lastHeaders[h.name.toLowerCase()] = h.value ?? ''
          }

          const labelIds = new Set(messagesList.flatMap((m) => m.labelIds ?? []))
          const isUnread = labelIds.has('UNREAD')
          const isInbox = labelIds.has('INBOX')

          const subject = lastHeaders['subject'] ?? firstHeaders['subject'] ?? gt.snippet?.split('.')[0]?.slice(0, 120) ?? '(no subject)'
          const date = lastHeaders['date'] ?? firstHeaders['date'] ?? new Date().toISOString()
          const snippet = lastMsg?.snippet ?? ''

          // Resolve which tracked email is involved
          let contactEmail = trackedEmails[0]!
          let contactName = contactEmail

          for (const msg of messagesList) {
            const headers: Record<string, string> = {}
            for (const h of msg.payload?.headers ?? []) {
              if (h.name) headers[h.name.toLowerCase()] = h.value ?? ''
            }
            const fromVal = headers['from'] ?? ''
            const toVal = headers['to'] ?? ''
            const foundEmail = trackedEmails.find(
              (e) => fromVal.toLowerCase().includes(e.toLowerCase()) || toVal.toLowerCase().includes(e.toLowerCase())
            )
            if (foundEmail) { contactEmail = foundEmail; break }
          }

          for (const msg of messagesList) {
            const headers: Record<string, string> = {}
            for (const h of msg.payload?.headers ?? []) {
              if (h.name) headers[h.name.toLowerCase()] = h.value ?? ''
            }
            const fromVal = headers['from'] ?? ''
            if (fromVal.toLowerCase().includes(contactEmail.toLowerCase())) {
              const nameMatch = fromVal.match(/^"([^"]+)"|^(^[^<]+)\s*</)
              if (nameMatch) {
                const parsedName = (nameMatch[1] || nameMatch[2] || '').trim()
                if (parsedName && !parsedName.includes('@')) {
                  contactName = parsedName
                  break
                }
              }
            }
          }

          // Match with email_outreach
          const outreach = outreachMap.get(tid)

          // Determine deal ownership: prefer outreach row's deal, then snooze record, then first deal
          const firstDealId = dealIds[0]!
          let resolvedDealId: string = outreach?.deal_id ?? ''
          if (!resolvedDealId) {
            const snoozeInfo = snoozedMap.get(tid)
            resolvedDealId = snoozeInfo?.dealId ?? firstDealId
          }

          // Skip inbox threads that are snoozed
          if (folder === 'inbox' && snoozedMap.has(tid)) return

          const snoozeInfo = snoozedMap.get(tid)

          threads[tid] = {
            threadId: tid,
            subject,
            snippet,
            dealName: addressMap.get(resolvedDealId) ?? 'Property',
            dealId: resolvedDealId,
            contactName,
            contactEmail: outreach?.contacts?.email?.[0] ?? contactEmail,
            status: outreach ? outreach.status : 'gmail',
            lastDate: date,
            responseClassification: outreach ? outreach.response_classification : null,
            messageCount: messagesList.length,
            isUnread,
            isInbox,
            snoozedUntil: snoozeInfo?.until ?? null,
          }
        })
      }
    } catch (gmailErr) {
      console.error('[campaign-emails] Gmail fetch FAILED:', gmailErr)
    }

    // Sort: unread first, then by date descending
    const sorted = Object.values(threads).sort((a, b) => {
      if (a.isUnread !== b.isUnread) return a.isUnread ? -1 : 1
      return new Date(b.lastDate ?? 0).getTime() - new Date(a.lastDate ?? 0).getTime()
    })

    return NextResponse.json({ threads: sorted, gmailConnected: true })
  } catch (err) {
    console.error('[campaign-emails] List error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
      return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
    }

    const { id: campaignId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = user.app_metadata?.role
    if (role !== 'internal') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await req.json()
    const { threadId, threadIds, action, snoozedUntil, messageId } = body

    const ids: string[] = threadIds ?? (threadId ? [threadId] : [])
    if (ids.length === 0) return NextResponse.json({ error: 'threadId or threadIds required' }, { status: 400 })
    if (!action) return NextResponse.json({ error: 'action required' }, { status: 400 })

    // Resolve campaign → project → Google connection
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('project_id')
      .eq('id', campaignId)
      .single()

    if (!campaign?.project_id) {
      return NextResponse.json({ error: 'Campaign not linked to a project' }, { status: 400 })
    }

    const { data: project } = await supabase
      .from('projects')
      .select('google_connection_id')
      .eq('id', campaign.project_id)
      .single()

    if (!project?.google_connection_id) {
      return NextResponse.json({ error: 'Project not connected to Gmail.' }, { status: 400 })
    }

    const connectionId = project.google_connection_id

    for (const id of ids) {
      switch (action) {
        case 'archive':
          await gmailAction(connectionId, id, [], ['INBOX'])
          break
        case 'unarchive':
          await gmailAction(connectionId, id, ['INBOX'], [])
          break
        case 'delete':
          await gmailAction(connectionId, id, [], [], 'trash')
          break
        case 'markRead':
          await gmailAction(connectionId, id, [], ['UNREAD'])
          break
        case 'markUnread':
          await gmailAction(connectionId, id, ['UNREAD'], [])
          break
        case 'snooze': {
          if (!snoozedUntil) {
            return NextResponse.json({ error: 'snoozedUntil required for snooze' }, { status: 400 })
          }
          await gmailAction(connectionId, id, [], ['INBOX'])
          // Find which deal this thread belongs to — use first deal in campaign as fallback
          const { data: campaignDeals } = await supabase
            .from('deals')
            .select('id')
            .eq('campaign_id', campaignId)
            .limit(1)
          const fallbackDealId = campaignDeals?.[0]?.id
          if (fallbackDealId) {
            await supabase.from('snoozed_threads').upsert({
              project_id: campaign.project_id,
              deal_id: fallbackDealId,
              thread_id: id,
              snoozed_until: snoozedUntil,
            }, { onConflict: 'project_id,thread_id' })
          }
          break
        }
        case 'unsnooze':
          await gmailAction(connectionId, id, ['INBOX'], [])
          await supabase.from('snoozed_threads').delete().eq('thread_id', id)
          break
        case 'deleteMessage':
          if (!messageId) {
            return NextResponse.json({ error: 'messageId required for deleteMessage' }, { status: 400 })
          }
          await gmailAction(connectionId, messageId, [], [], 'trashMessage')
          break
        default:
          return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[campaign-emails] PATCH error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 })
  }
}

async function gmailAction(
  connectionId: string,
  id: string,
  addLabels: string[],
  removeLabels: string[],
  mode: 'modify' | 'trash' | 'trashMessage' = 'modify',
) {
  const { modifyThreadLabels, trashThread, trashMessage } = await import('@/lib/google/gmail')

  switch (mode) {
    case 'trash':
      await trashThread(connectionId, id)
      break
    case 'trashMessage':
      await trashMessage(connectionId, id)
      break
    default:
      await modifyThreadLabels(connectionId, id, addLabels, removeLabels)
  }
}
