import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthedClientByConnection } from '@/lib/google/oauth'
import { google } from 'googleapis'

interface DealField {
  value: string | null
  field_definitions: {
    key: string
  } | null
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
  conversation_log: unknown
  created_at: string
  deals: { portfolio_id: string | null } | null
  contacts: { name: string | null; email: string[] | null } | null
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: dealId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check user role
    const role = user.app_metadata?.role
    if (role !== 'internal') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const includePortfolio = req.nextUrl.searchParams.get('portfolio') === 'true'
    const folder = req.nextUrl.searchParams.get('folder') ?? 'inbox'

    // ── 1. Self-healing unsnooze check ──
    try {
      const { data: expiredSnoozes } = await supabase
        .from('snoozed_threads')
        .select('id, thread_id, project_id')
        .lt('snoozed_until', new Date().toISOString())

      if (expiredSnoozes && expiredSnoozes.length > 0) {
        const projectIds = Array.from(new Set(expiredSnoozes.map((s) => s.project_id)))
        const { data: projects } = await supabase
          .from('projects')
          .select('id, google_connection_id')
          .in('id', projectIds)

        const connMap = new Map(projects?.map((p) => [p.id, p.google_connection_id]) ?? [])

        for (const snooze of expiredSnoozes) {
          const connId = connMap.get(snooze.project_id)
          if (connId) {
            try {
              const auth = await getAuthedClientByConnection(connId, { useAdminClient: true })
              const gmailClient = google.gmail({ version: 'v1', auth })
              await gmailClient.users.threads.modify({
                userId: 'me',
                id: snooze.thread_id,
                requestBody: { addLabelIds: ['INBOX'] },
              })
            } catch (err) {
              console.error(`[emails] Failed to restore thread ${snooze.thread_id} to INBOX:`, err)
            }
          }
          await supabase.from('snoozed_threads').delete().eq('id', snooze.id)
        }
      }
    } catch (snoozeErr) {
      console.error('[emails] Snooze expiration processing failed:', snoozeErr)
    }

    // Get the deal with project and portfolio info and its deal_fields.
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select('id, portfolio_id, project_id, deal_fields(value, field_definitions(key))')
      .eq('id', dealId)
      .maybeSingle()

    if (dealError) {
      console.error('[emails] Deal query error:', dealError.message, dealError.details, dealError.hint)
      return NextResponse.json({ error: dealError.message }, { status: 500 })
    }
    if (!deal) {
      console.error('[emails] Deal not found:', dealId)
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    const dealFields = (deal.deal_fields as unknown as DealField[]) ?? []
    const dealAddressField = dealFields.find((f) => f?.field_definitions?.key === 'address')
    const mainAddress = dealAddressField?.value ?? 'Property'

    const addressMap = new Map<string, string>()
    addressMap.set(dealId, mainAddress)

    // Build the set of deal IDs to include
    const dealIds = [dealId]

    if (includePortfolio && deal.portfolio_id) {
      const { data: siblings } = await supabase
        .from('deals')
        .select('id, deal_fields(value, field_definitions(key))')
        .eq('portfolio_id', deal.portfolio_id)
        .neq('id', dealId)

      for (const s of siblings ?? []) {
        dealIds.push(s.id)
        const sFields = (s.deal_fields as unknown as DealField[]) ?? []
        const addrField = sFields.find((f) => f?.field_definitions?.key === 'address')
        addressMap.set(s.id, addrField?.value ?? 'Property')
      }
    }

    // Fetch all email_outreach rows for these deals
    const { data: emails, error } = await supabase
      .from('email_outreach')
      .select(`
        id,
        deal_id,
        contact_id,
        status,
        sent_at,
        subject,
        gmail_thread_id,
        gmail_message_id,
        response_classification,
        responded_at,
        conversation_log,
        created_at,
        deals!inner(portfolio_id),
        contacts(name, email)
      `)
      .in('deal_id', dealIds)
      .order('sent_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const outreachMap = new Map<string, OutreachRow>()
    for (const e of (emails as unknown as OutreachRow[]) ?? []) {
      const tid = e.gmail_thread_id ?? e.id
      outreachMap.set(tid, e)
    }

    // Get active snoozed threads
    const { data: activeSnoozedRows } = await supabase
      .from('snoozed_threads')
      .select('thread_id, snoozed_until')
      .eq('deal_id', dealId)
    const snoozedMap = new Map<string, string>(
      activeSnoozedRows?.map((r) => [r.thread_id, r.snoozed_until]) ?? []
    )

    // Get contacts for these deals
    const { data: contacts } = await supabase
      .from('contacts')
      .select('email')
      .in('deal_id', dealIds)

    const trackedEmails = contacts?.flatMap((c) => c.email ?? []).filter((e) => e.length > 0) ?? []

    // Resolve Google connection from the deal's project
    let connectionId: string | null = null
    if (trackedEmails.length > 0) {
      const { data: project } = await supabase
        .from('projects')
        .select('google_connection_id')
        .eq('id', deal.project_id)
        .single()

      connectionId = project?.google_connection_id ?? null
    }

    const threads: Record<string, {
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
      isPortfolioSibling: boolean
      isUnread: boolean
      isInbox: boolean
      snoozedUntil: string | null
    }> = {}

    if (connectionId && trackedEmails.length > 0) {
      try {
        const auth = await getAuthedClientByConnection(connectionId, { useAdminClient: true })
        const gmail = google.gmail({ version: 'v1', auth })

        // Build search query based on folder
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

        console.log(`[emails] Gmail query for folder ${folder}: ${query}`)
        const listRes = await gmail.users.threads.list({ userId: 'me', q: query, maxResults: 30 })
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

            // Parse headers
            const firstHeaders: Record<string, string> = {}
            for (const h of firstMsg?.payload?.headers ?? []) {
              if (h.name) firstHeaders[h.name.toLowerCase()] = h.value ?? ''
            }
            const lastHeaders: Record<string, string> = {}
            for (const h of lastMsg?.payload?.headers ?? []) {
              if (h.name) lastHeaders[h.name.toLowerCase()] = h.value ?? ''
            }

            // Determine if read/unread (does any message have UNREAD label?)
            const labelIds = new Set(messagesList.flatMap((m) => m.labelIds ?? []))
            const isUnread = labelIds.has('UNREAD')
            const isInbox = labelIds.has('INBOX')

            // Resolve subject and date
            const subject = lastHeaders['subject'] ?? firstHeaders['subject'] ?? gt.snippet?.split('.')[0]?.slice(0, 120) ?? '(no subject)'
            const date = lastHeaders['date'] ?? firstHeaders['date'] ?? new Date().toISOString()
            const snippet = lastMsg?.snippet ?? ''

            // Resolve contact info
            let contactEmail = trackedEmails[0]!
            let contactName = contactEmail

            // 1. First, find which tracked email is involved in this thread
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
              if (foundEmail) {
                contactEmail = foundEmail
                break
              }
            }

            // 2. Now scan all messages to find a display name for this contact (from their incoming emails)
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
                    break // Found a valid display name from the contact's email, so stop!
                  }
                }
              }
            }

            // Match with local email_outreach database record
            const outreach = outreachMap.get(tid)

            // Skip if in inbox view but it's snoozed in DB
            if (folder === 'inbox' && snoozedMap.has(tid)) {
              return
            }

            threads[tid] = {
              threadId: tid,
              subject,
              snippet,
              dealName: outreach ? (addressMap.get(outreach.deal_id) ?? 'Property') : mainAddress,
              dealId: outreach ? outreach.deal_id : dealId,
              contactName: contactName,
              contactEmail: outreach?.contacts?.email?.[0] ?? contactEmail,
              status: outreach ? outreach.status : 'gmail',
              lastDate: date,
              responseClassification: outreach ? outreach.response_classification : null,
              messageCount: messagesList.length,
              isPortfolioSibling: outreach ? outreach.deal_id !== dealId : false,
              isUnread,
              isInbox,
              snoozedUntil: snoozedMap.get(tid) ?? null,
            }
          })
        }
      } catch (gmailErr) {
        console.error('[emails] Gmail fetch FAILED:', gmailErr)
      }
    }

    // Sort: unread first, then by date descending
    const sorted = Object.values(threads).sort((a, b) => {
      if (a.isUnread !== b.isUnread) return a.isUnread ? -1 : 1
      return new Date(b.lastDate ?? 0).getTime() - new Date(a.lastDate ?? 0).getTime()
    })

    return NextResponse.json({ threads: sorted, gmailConnected: !!connectionId })
  } catch (err) {
    console.error('Emails list error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
