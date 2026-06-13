import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createPortfolioSchema } from '@/lib/validations/portfolio.schema'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const projectId = req.nextUrl.searchParams.get('project_id')

  let query = supabase
    .from('portfolios')
    .select('*, deals!deals_portfolio_id_fkey(id), portfolio_deal_id')
    .order('created_at', { ascending: false })

  if (projectId) query = query.eq('project_id', projectId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
    return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = createPortfolioSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  // 1. Create the portfolio row
  const { data: portfolio, error: portfolioError } = await supabase
    .from('portfolios')
    .insert({
      ...parsed.data,
      created_by: user.id,
    })
    .select()
    .single()

  if (portfolioError || !portfolio) {
    return NextResponse.json({ error: portfolioError?.message ?? 'Failed to create portfolio' }, { status: 500 })
  }

  // 2. Create a linked deal record so the portfolio has full deal capabilities
  const { data: linkedDeal, error: dealError } = await supabase
    .from('deals')
    .insert({
      project_id: parsed.data.project_id ?? null,
      is_portfolio: true,
      stage: 'lead',
      created_by: user.id,
    })
    .select('id')
    .single()

  if (dealError || !linkedDeal) {
    // Clean up the orphaned portfolio row
    await supabase.from('portfolios').delete().eq('id', portfolio.id)
    return NextResponse.json({ error: dealError?.message ?? 'Failed to create linked deal' }, { status: 500 })
  }

  // 3. Set the address deal_field to the portfolio name
  // Resolve the 'address' field definition: prefer project-scoped, fall back to global
  const { data: fieldDefs } = await supabase
    .from('field_definitions')
    .select('id')
    .eq('key', 'address')
    .or(`project_id.eq.${parsed.data.project_id ?? '00000000-0000-0000-0000-000000000000'},project_id.is.null`)
    .order('project_id', { ascending: false, nullsFirst: false })
    .limit(1)

  const fieldDefId = fieldDefs?.[0]?.id

  if (fieldDefId) {
    await supabase.from('deal_fields').insert({
      deal_id: linkedDeal.id,
      field_id: fieldDefId,
      value: parsed.data.name,
    })
  }

  // 4. Seed document checklist for the linked deal
  await supabase.rpc('seed_default_checklist', { p_deal_id: linkedDeal.id })

  // 5. Link the portfolio to its deal
  const { data: updated, error: updateError } = await supabase
    .from('portfolios')
    .update({ portfolio_deal_id: linkedDeal.id })
    .eq('id', portfolio.id)
    .select()
    .single()

  if (updateError || !updated) {
    return NextResponse.json({ error: updateError?.message ?? 'Failed to link deal' }, { status: 500 })
  }

  return NextResponse.json(updated, { status: 201 })
}
