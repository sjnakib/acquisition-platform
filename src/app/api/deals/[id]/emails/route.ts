import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthedClientByConnection } from '@/lib/google/oauth'
import { google } from 'googleapis'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: dealId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const includePortfolio = req.nextUrl.searchParams.get('portfolio') === 'true'

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

    const dealFields = (deal.deal_fields as any) ?? []
    const dealAddressField = dealFields.find((f: any) => f?.field_definitions?.key === 'address')
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
        const sFields = (s.deal_fields as any) ?? []
        const addrField = sFields.find((f: any) => f?.field_definitions?.key === 'address')
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

    // Group email_outreach rows by thread_id
    const threads: Record<string, {
      threadId: string
      subject: string | null
      dealName: string | null
      dealId: string
      contactName: string | null
      contactEmail: string | null
      status: string
      lastDate: string | null
      responseClassification: string | null
      messageCount: number
      isPortfolioSibling: boolean
    }> = {}

    const knownThreadIds = new Set<string>()

    for (const e of emails ?? []) {
      const threadId = e.gmail_thread_id ?? e.id
      const dealData = e.deals as unknown as { portfolio_id: string | null } | null
      const contactData = e.contacts as unknown as { name: string | null; email: string[] | null } | null
      const isSibling = e.deal_id !== dealId

      knownThreadIds.add(threadId)

      if (!threads[threadId] || new Date(e.sent_at ?? e.created_at).getTime() > new Date(threads[threadId]!.lastDate ?? 0).getTime()) {
        threads[threadId] = {
          threadId,
          subject: e.subject,
          dealName: addressMap.get(e.deal_id) ?? 'Property',
          dealId: e.deal_id,
          contactName: contactData?.name ?? null,
          contactEmail: contactData?.email?.[0] ?? null,
          status: e.status,
          lastDate: e.sent_at ?? e.created_at,
          responseClassification: e.response_classification,
          messageCount: 1,
          isPortfolioSibling: isSibling,
        }
      } else {
        threads[threadId]!.messageCount++
      }
    }

    // ── Gmail search: find threads involving tracked emails ──────────────────

    // Get tracked emails for this deal
    const { data: contacts } = await supabase
      .from('contacts')
      .select('email')
      .eq('deal_id', dealId)

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

    if (connectionId && trackedEmails.length > 0) {
      try {
        console.log(`[emails] Searching Gmail for ${trackedEmails.length} tracked: ${trackedEmails.join(', ')}`)

        // Use admin client to read tokens — bypasses any RLS ambiguity
        const auth = await getAuthedClientByConnection(connectionId, { useAdminClient: true })
        const gmail = google.gmail({ version: 'v1', auth })

        // Gmail search query: find threads involving any tracked email.
        // Use plain OR without grouping — most compatible with Gmail search parser.
        const terms = trackedEmails.flatMap((email) => [`from:${email}`, `to:${email}`])
        const query = terms.join(' OR ')

        console.log(`[emails] Gmail query: ${query}`)
        const listRes = await gmail.users.threads.list({ userId: 'me', q: query, maxResults: 30 })
        const gmailThreads = listRes.data.threads ?? []
        console.log(`[emails] Gmail returned ${gmailThreads.length} threads (${knownThreadIds.size} already in outreach)`)

        let syntheticDate = Date.now()
        let addedCount = 0
        for (const gt of gmailThreads) {
          const tid = gt.id
          if (!tid || knownThreadIds.has(tid)) continue

          const matchedEmail = trackedEmails.find((e) =>
            gt.snippet?.toLowerCase().includes(e.toLowerCase())
          ) ?? trackedEmails[0]!

          threads[tid] = {
            threadId: tid,
            subject: gt.snippet?.split('.')[0]?.slice(0, 120) ?? '(no subject)',
            dealName: mainAddress,
            dealId,
            contactName: matchedEmail,
            contactEmail: matchedEmail,
            status: 'gmail',
            lastDate: new Date(syntheticDate).toISOString(),
            responseClassification: null,
            messageCount: 1,
            isPortfolioSibling: false,
          }
          syntheticDate -= 1000
          addedCount++
        }
        console.log(`[emails] Added ${addedCount} new Gmail threads, total threads: ${Object.keys(threads).length}`)
      } catch (gmailErr) {
        console.error('[emails] Gmail search FAILED:', gmailErr)
      }
    } else {
      console.log(`[emails] Skipping Gmail search — conn=${!!connectionId} tracked=${trackedEmails.length}`)
    }

    const sorted = Object.values(threads).sort(
      (a, b) => new Date(b.lastDate ?? 0).getTime() - new Date(a.lastDate ?? 0).getTime()
    )

    return NextResponse.json(sorted)
  } catch (err) {
    console.error('Emails list error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
