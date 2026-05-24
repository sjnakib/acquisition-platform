import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: dealId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const includePortfolio = req.nextUrl.searchParams.get('portfolio') === 'true'

    // Get the deal's portfolio_id first
    const { data: deal } = await supabase
      .from('deals')
      .select('id, deal_name, portfolio_id, project_id')
      .eq('id', dealId)
      .single()

    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

    // Build the set of deal IDs to include
    const dealIds = [dealId]

    if (includePortfolio && deal.portfolio_id) {
      const { data: siblings } = await supabase
        .from('deals')
        .select('id, deal_name')
        .eq('portfolio_id', deal.portfolio_id)
        .neq('id', dealId)

      for (const s of siblings ?? []) {
        dealIds.push(s.id)
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
        deals!inner(deal_name, portfolio_id),
        contacts(full_name, email)
      `)
      .in('deal_id', dealIds)
      .order('sent_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Group by thread_id, then by deal
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

    for (const e of emails ?? []) {
      const threadId = e.gmail_thread_id ?? e.id
      const dealData = e.deals as unknown as { deal_name: string | null; portfolio_id: string | null } | null
      const contactData = e.contacts as unknown as { full_name: string | null; email: string | null } | null
      const isSibling = e.deal_id !== dealId

      if (!threads[threadId] || new Date(e.sent_at ?? e.created_at).getTime() > new Date(threads[threadId]!.lastDate ?? 0).getTime()) {
        threads[threadId] = {
          threadId,
          subject: e.subject,
          dealName: dealData?.deal_name ?? null,
          dealId: e.deal_id,
          contactName: contactData?.full_name ?? null,
          contactEmail: contactData?.email ?? null,
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

    const sorted = Object.values(threads).sort(
      (a, b) => new Date(b.lastDate ?? 0).getTime() - new Date(a.lastDate ?? 0).getTime()
    )

    return NextResponse.json(sorted)
  } catch (err) {
    console.error('Emails list error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
