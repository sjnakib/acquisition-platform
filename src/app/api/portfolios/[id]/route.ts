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
    .select('*, deals!deals_portfolio_id_fkey(*, deal_fields(value, field_definitions(key, label, data_type)), underwriting(*), loi_records(*))')
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

  // Update the portfolio row
  const { data, error } = await supabase
    .from('portfolios')
    .update(body)
    .eq('id', id)
    .select('portfolio_deal_id, project_id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If name changed, sync to the linked deal's address deal_field
  if (body.name && data?.portfolio_deal_id) {
    // Resolve the 'address' field definition for the deal_field upsert
    const { data: fieldDefs } = await supabase
      .from('field_definitions')
      .select('id')
      .eq('key', 'address')
      .or(`project_id.eq.${data.project_id ?? '00000000-0000-0000-0000-000000000000'},project_id.is.null`)
      .order('project_id', { ascending: false, nullsFirst: false })
      .limit(1)

    const fieldDefId = fieldDefs?.[0]?.id

    if (fieldDefId) {
      // Upsert the address field — update if exists, insert if not
      const { data: existing } = await supabase
        .from('deal_fields')
        .select('id')
        .eq('deal_id', data.portfolio_deal_id)
        .eq('field_id', fieldDefId)
        .maybeSingle()

      if (existing) {
        await supabase
          .from('deal_fields')
          .update({ value: body.name })
          .eq('id', existing.id)
      } else {
        await supabase
          .from('deal_fields')
          .insert({
            deal_id: data.portfolio_deal_id,
            field_id: fieldDefId,
            value: body.name,
          })
      }
    }
  }

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

  // Get the linked deal ID before deleting
  const { data: portfolio } = await supabase
    .from('portfolios')
    .select('portfolio_deal_id')
    .eq('id', id)
    .single()

  if (mode === 'orphan') {
    await supabase.from('deals').update({ portfolio_id: null }).eq('portfolio_id', id)
  } else if (mode === 'archive') {
    await supabase.from('deals')
      .update({ stage: 'archived', is_archived: true, archive_reason: 'Portfolio Deleted' })
      .eq('portfolio_id', id)
      .not('stage', 'in', '(loi,closed,failed)')
  }

  // Delete the linked deal first (cascade handles deal_fields, checklist, etc.)
  if (portfolio?.portfolio_deal_id) {
    await supabase.from('deals').delete().eq('id', portfolio.portfolio_deal_id)
  }

  // Delete the portfolio row
  const { error } = await supabase.from('portfolios').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
