import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('document_checklist')
      .select('*')
      .eq('deal_id', id)
      .order('sort_order', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('Documents get error:', err)
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
    const { doc_id, collected, doc_name, metadata } = body

    if (doc_id) {
      // Update existing row
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (typeof collected === 'boolean') updates.collected = collected
      if (doc_name != null) updates.doc_name = doc_name
      if (metadata != null) updates.metadata = metadata

      const { data, error } = await supabase
        .from('document_checklist')
        .update(updates)
        .eq('id', doc_id)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data)
    }

    // Create new row
    const { data, error } = await supabase
      .from('document_checklist')
      .insert({
        deal_id: id,
        doc_name: doc_name ?? 'Untitled Document',
        collected: collected ?? false,
        metadata: metadata ?? {},
        sort_order: 999,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('Documents patch error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
