import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
      return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
    }

    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { data: loi } = await supabase.from('loi_records').update(body).eq('id', id).select().single()
    if (!loi) return NextResponse.json({ error: 'LOI not found' }, { status: 404 })

    if (body.outcome === 'deal_reached') {
      await supabase.from('deals').update({ stage: 'closed' }).eq('id', loi.deal_id)
    } else if (body.outcome === 'fallen_through') {
      await supabase.from('deals').update({
        is_archived: true,
        archive_reason: 'LOI fallen through',
        stage: 'archived',
      }).eq('id', loi.deal_id)
    }

    return NextResponse.json(loi)
  } catch (err) {
    console.error('LOI patch error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
