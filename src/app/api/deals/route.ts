import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createDealSchema } from '@/lib/validations/deal.schema'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const searchParams = req.nextUrl.searchParams
    const campaignId = searchParams.get('campaign_id')
    const stage = searchParams.get('stage')
    const score = searchParams.get('score')
    const search = searchParams.get('search')

    let query = supabase
      .from('deals')
      .select(`
        *,
        campaigns(name, market),
        underwriting(underwritability, asking_price, asking_price_per_unit),
        email_outreach(id, status, response_classification),
        call_briefs(id, call_status, published)
      `)
      .order('created_at', { ascending: false })

    if (campaignId) query = query.eq('campaign_id', campaignId)
    if (stage) query = query.eq('stage', stage)
    if (score) query = query.eq('score', score)
    if (search) query = query.textSearch('deal_name', search, { type: 'websearch' })

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('Deals list error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
      return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const parsed = createDealSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const { data, error } = await supabase.from('deals').insert({
      ...parsed.data,
      created_by: user.id,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('Deal create error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
