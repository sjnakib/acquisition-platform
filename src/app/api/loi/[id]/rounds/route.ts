import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('loi_rounds')
      .select('*')
      .eq('loi_id', id)
      .order('round_num', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('LOI rounds get error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
      return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
    }

    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()

    const { data: maxRound } = await supabase
      .from('loi_rounds')
      .select('round_num')
      .eq('loi_id', id)
      .order('round_num', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextRound = (maxRound?.round_num ?? 0) + 1

    const { data, error } = await supabase.from('loi_rounds').insert({
      loi_id: id,
      round_num: nextRound,
      price: body.price,
      party: body.party,
      round_date: body.round_date,
      notes: body.notes,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('LOI round create error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
