import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { deletePortfolioSchema } from '@/lib/validations/portfolio.schema'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('portfolios')
    .select('*, deals(*)')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
    return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
  }

  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { data, error } = await supabase
    .from('portfolios')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
    return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
  }

  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = deletePortfolioSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid mode', details: parsed.error.flatten() }, { status: 400 })
  }

  const { mode } = parsed.data

  if (mode === 'orphan') {
    await supabase.from('deals').update({ portfolio_id: null }).eq('portfolio_id', id)
  } else if (mode === 'archive') {
    await supabase.from('deals')
      .update({ stage: 'archived', is_archived: true, archive_reason: 'Portfolio Deleted' })
      .eq('portfolio_id', id)
      .not('stage', 'in', '(loi,closed,failed)')
  }

  const { error } = await supabase.from('portfolios').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
