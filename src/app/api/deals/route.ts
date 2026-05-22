import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createDealSchema } from '@/lib/validations/deal.schema'

/** Maps DataGrid column keys to Supabase .order() column paths. */
const SORT_COLUMNS: Record<string, string> = {
  stage: 'stage',
  score: 'score',
  created_at: 'created_at',
  last_email_sent_on: 'last_email_sent_on',
  campaign: 'campaigns(name)',
  portfolio: 'portfolios(name)',
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const searchParams = req.nextUrl.searchParams
    const projectId  = searchParams.get('project_id')
    const campaignId = searchParams.get('campaign_id')
    const stage = searchParams.get('stage')
    const score = searchParams.get('score')
    const search = searchParams.get('search')
    const sortKey = searchParams.get('sort')
    const sortOrder = (searchParams.get('order') ?? 'desc') as 'asc' | 'desc'
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '100', 10) || 100, 5000)
    const offset = parseInt(searchParams.get('offset') ?? '0', 10) || 0

    // Build the filtered query for paginated data
    let query = supabase
      .from('deals')
      .select(`
        *,
        campaigns(name, market),
        portfolios(id, name),
        deal_fields(value, field_definitions(key, label, data_type)),
        underwriting(*),
        loi_records(*),
        document_checklist(*),
        email_outreach(id, status, response_classification),
        call_briefs(id, call_status, published)
      `, { count: 'exact' })
      .range(offset, offset + limit - 1)

    const sortColumn = (sortKey && SORT_COLUMNS[sortKey]) ? SORT_COLUMNS[sortKey] : 'created_at'
    const ascending = sortOrder === 'asc'
    query = query.order(sortColumn, { ascending })

    if (campaignId) query = query.eq('campaign_id', campaignId)
    if (projectId)  query = query.eq('project_id', projectId)
    if (stage) {
      const stages = searchParams.getAll('stage')
      if (stages.length > 1) query = query.in('stage', stages)
      else query = query.eq('stage', stages[0]!)
    }
    if (score) query = query.eq('score', score)
    if (search) {
      const { data: matchingDealIds } = await supabase
        .from('deal_fields')
        .select('deal_id')
        .ilike('value', `%${search}%`)
      if (matchingDealIds && matchingDealIds.length > 0) {
        query = query.in('id', matchingDealIds.map((r) => r.deal_id))
      } else {
        query = query.eq('id', '00000000-0000-0000-0000-000000000000')
      }
    }

    const { data, error, count } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ data, total: count ?? 0, filtered_total: count ?? 0 })
  } catch (err) {
    console.error('Deals list error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const BATCH_CHUNK = 500

export async function DELETE(req: NextRequest) {
  try {
    if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
      return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const searchParams = req.nextUrl.searchParams
    const projectId  = searchParams.get('project_id')
    const campaignId = searchParams.get('campaign_id')
    const stage = searchParams.get('stage')
    const score = searchParams.get('score')
    const search = searchParams.get('search')

    // Fetch just the IDs matching the filters
    function idQuery() {
      let q = supabase.from('deals').select('id')
      if (projectId)  q = q.eq('project_id', projectId)
      if (campaignId) q = q.eq('campaign_id', campaignId)
      if (stage) {
        const stages = searchParams.getAll('stage')
        if (stages.length > 1) q = q.in('stage', stages)
        else q = q.eq('stage', stages[0]!)
      }
      if (score) q = q.eq('score', score)
      return q
    }

    // If searching, filter by deal_fields match first
    let searchMatchIds: string[] | null = null
    if (search) {
      const { data: matching } = await supabase
        .from('deal_fields')
        .select('deal_id')
        .ilike('value', `%${search}%`)
      if (!matching || matching.length === 0) {
        return NextResponse.json({ deleted: 0 })
      }
      searchMatchIds = matching.map((r) => r.deal_id)
    }

    // Collect all matching IDs (chunked since could be many)
    const allIds: string[] = []
    let offset = 0
    while (true) {
      let q = idQuery()
      if (searchMatchIds) q = q.in('id', searchMatchIds)
      const { data, error } = await q.range(offset, offset + BATCH_CHUNK - 1)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      if (!data || data.length === 0) break
      allIds.push(...data.map((r: { id: string }) => r.id))
      if (data.length < BATCH_CHUNK) break
      offset += BATCH_CHUNK
    }

    // Delete in chunks
    let deleted = 0
    for (let i = 0; i < allIds.length; i += BATCH_CHUNK) {
      const chunk = allIds.slice(i, i + BATCH_CHUNK)
      const { error } = await supabase.from('deals').delete().in('id', chunk)
      if (error) {
        return NextResponse.json({ error: error.message, deleted, remaining: allIds.length - deleted }, { status: 500 })
      }
      deleted += chunk.length
    }

    return NextResponse.json({ deleted })
  } catch (err) {
    console.error('Deals delete-all error:', err)
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
