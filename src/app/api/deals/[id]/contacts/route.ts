import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: dealId } = await params
    const search = req.nextUrl.searchParams.get('search') ?? ''
    const all = req.nextUrl.searchParams.get('all') === 'true'

    // ── Resolve portfolio context ──────────────────────────────────────────
    // Portfolio deals are synthetic — they have no contacts of their own.
    // Include contacts from all member deals so the "Tracked Emails" panel
    // shows the full set of tracked emails for the portfolio.

    const dealIds = [dealId]

    const { data: deal } = await supabase
      .from('deals')
      .select('is_portfolio')
      .eq('id', dealId)
      .maybeSingle()

    if (deal?.is_portfolio) {
      const { data: portfolio } = await supabase
        .from('portfolios')
        .select('id')
        .eq('portfolio_deal_id', dealId)
        .maybeSingle()

      if (portfolio) {
        const { data: members } = await supabase
          .from('deals')
          .select('id')
          .eq('portfolio_id', portfolio.id)

        for (const m of (members ?? [])) {
          dealIds.push(m.id)
        }
      }
    }

    // Contacts are linked to deals via deal_id FK
    let query = supabase
      .from('contacts')
      .select('id, name, company, title, email, phone_office, phone_cell, is_primary, deal_id')
      .in('deal_id', dealIds)
      .order('is_primary', { ascending: false })
      .order('name', { ascending: true })

    if (!all) {
      query = query.limit(20)
    }

    if (search) {
      query = query.ilike('name', `%${search}%`)
    }

    const { data: contacts, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Deduplicate by email — first occurrence wins (portfolio deal contacts
    // come first since dealId is first in dealIds). Remove duplicates that
    // have the same email as an earlier contact but a different deal_id.
    const seen = new Set<string>()
    const deduped = (contacts ?? []).filter((c) => {
      const emails = (c.email as string[] | null) ?? []
      const key = emails.sort().join(',')
      if (!key) return true // keep contacts with no email
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    return NextResponse.json(deduped)
  } catch (err) {
    console.error('Deal contacts error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
