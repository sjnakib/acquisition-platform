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

    // Contacts are linked to deals via deal_id FK — query directly
    let query = supabase
      .from('contacts')
      .select('id, name, company, title, email, phone_office, phone_cell, is_primary')
      .eq('deal_id', dealId)
      .order('is_primary', { ascending: false })
      .order('name', { ascending: true })
      .limit(20)

    if (search) {
      // Search by name (case-insensitive) — sufficient for compose autocomplete
      query = query.ilike('name', `%${search}%`)
    }

    const { data: contacts, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(contacts ?? [])
  } catch (err) {
    console.error('Deal contacts error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
