import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('call_briefs')
      .select('*, deals(deal_name, score, unit_count)')
      .eq('id', id)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('Call get error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

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
    const updateData: Record<string, unknown> = {}

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    const isClient = profile?.role === 'client'

    if (isClient) {
      if (body.call_status) updateData.call_status = body.call_status
      if (body.client_notes !== undefined) updateData.client_notes = body.client_notes
    } else {
      if (body.summary_text !== undefined) updateData.summary_text = body.summary_text
      if (body.published !== undefined) {
        updateData.published = body.published
        if (body.published) updateData.published_at = new Date().toISOString()
      }
      if (body.call_status) updateData.call_status = body.call_status
    }

    if (body.call_status === 'completed') {
      updateData.completed_at = new Date().toISOString()
    }

    const { data, error } = await supabase.from('call_briefs').update(updateData).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('Call patch error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
