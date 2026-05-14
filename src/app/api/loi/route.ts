import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
      return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { deal_id, submitted_at, offered_price } = await req.json()

    const { data, error } = await supabase.from('loi_records').upsert(
      { deal_id, submitted_at, offered_price },
      { onConflict: 'deal_id' }
    ).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabase.from('deals').update({ stage: 'loi' }).eq('id', deal_id)

    return NextResponse.json(data)
  } catch (err) {
    console.error('LOI create error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
