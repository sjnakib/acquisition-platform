import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createDealSchema } from '@/lib/validations/deal.schema'

/** Maps DataGrid column keys to Supabase .order() column paths. */
const SORT_COLUMNS: Record<string, string> = {
  stage: 'stage',
  score: 'score',
  created_at: 'created_at',
  last_email_sent_on: 'last_email_sent_on',
  response_type: 'response_type',
  campaign: 'campaigns(name)',
  portfolio: 'portfolios!deals_portfolio_id_fkey(name)',
}

interface OutreachPending {
  status?: string
  needs_review?: boolean
  snoozed_until?: string | null
  gmail_thread_id?: string | null
}

interface PendingReviewResult {
  has_pending_review: boolean
  pending_review_thread_id: string | null
  pending_review_count: number
}

function computePendingReview(outreach: unknown): PendingReviewResult {
  const records = outreach as OutreachPending[] | null | undefined
  if (!records?.length) return { has_pending_review: false, pending_review_thread_id: null, pending_review_count: 0 }
  const now = new Date()
  let hasPending = false
  let threadId: string | null = null
  let count = 0
  for (const o of records) {
    if (!o.needs_review || o.status !== 'replied') continue
    if (o.snoozed_until && new Date(o.snoozed_until) > now) continue
    if (!hasPending) {
      hasPending = true
      threadId = o.gmail_thread_id ?? null
    }
    count++
  }
  return { has_pending_review: hasPending, pending_review_thread_id: threadId, pending_review_count: count }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const searchParams = req.nextUrl.searchParams
    const projectId  = searchParams.get('project_id')
    const campaignId = searchParams.get('campaign_id')
    const isPortfolio = searchParams.get('is_portfolio')
    const stage = searchParams.get('stage')
    const score = searchParams.get('score')
    const search = searchParams.get('search')
    const sortKey = searchParams.get('sort')
    const sortOrder = (searchParams.get('order') ?? 'desc') as 'asc' | 'desc'
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '100', 10) || 100, 5000)
    const offset = parseInt(searchParams.get('offset') ?? '0', 10) || 0

    // Build the filtered query for paginated data.
    // Clients get a lightweight select — only tables with client RLS policies
    // (deal_fields, call_briefs). Internal gets full joins. This avoids PostgREST
    // edge cases where joins to internal-only tables silently empty the result.
    const role = user.app_metadata?.role
    const view = searchParams.get('view')

    // Dashboard / counts views: minimal select — only what's needed for aggregation
    const isStaff = role === 'internal' || role === 'admin'

    if (isStaff && (view === 'dashboard' || view === 'counts')) {
      const selectFields = '*, campaigns(name, market), email_outreach(id, status, response_classification, needs_review, snoozed_until)'
      let query = supabase
        .from('deals')
        .select(selectFields, { count: 'exact' })
        .range(offset, offset + limit - 1)
      // ... (rest of filtering replicated inline below)

      if (projectId) query = query.eq('project_id', projectId)
      if (campaignId) query = query.eq('campaign_id', campaignId)
      if (isPortfolio === 'true') query = query.eq('is_portfolio', true)
      else if (isPortfolio === 'false') query = query.eq('is_portfolio', false)
      if (stage) {
        const stages = searchParams.getAll('stage')
        if (stages.length > 1) query = query.in('stage', stages)
        else query = query.eq('stage', stages[0]!)
      }
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
      query = query.order('created_at', { ascending: false })

      const { data, error, count } = await query
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      // Attach review flags — any email_outreach with needs_review=true and not snoozed
      const rows = (data ?? []) as unknown as Record<string, unknown>[]
      const enriched = rows.map((deal) => ({
        ...deal,
        ...computePendingReview(deal.email_outreach),
      }))

      return NextResponse.json({ data: enriched, total: count ?? 0, filtered_total: count ?? 0 })
    }

    // Staff users get all related data. Client users get a lightweight select
    // — underwriting is excluded for clients because RLS (is_staff()) blocks it.
    const staffSelect = '*, campaigns(name, market), portfolios!deals_portfolio_id_fkey(id, name), deal_fields(value, field_definitions(key, label, data_type)), underwriting(*), loi_records(*), document_checklist(*), email_outreach(id, status, response_classification, needs_review, snoozed_until, gmail_thread_id), call_briefs(id, call_status, published)'
    const clientSelect = '*, deal_fields(value, field_definitions(key, label, data_type)), call_briefs(id, call_status, published)'

    const selectFields = isStaff ? staffSelect : clientSelect

    let query = supabase
      .from('deals')
      .select(selectFields, { count: 'exact' })
      .range(offset, offset + limit - 1)

    const sortColumn = (sortKey && SORT_COLUMNS[sortKey]) ? SORT_COLUMNS[sortKey] : 'created_at'
    const ascending = sortOrder === 'asc'
    query = query.order(sortColumn, { ascending })

    // Client users: enforce non-archived deals.
    // Mirrors RLS policy (migration 0039) as defense-in-depth.
    if (role === 'client') {
      query = query.eq('is_archived', false)
    }

    if (campaignId) query = query.eq('campaign_id', campaignId)
    if (projectId)  query = query.eq('project_id', projectId)
    if (isPortfolio === 'true') query = query.eq('is_portfolio', true)
    else if (isPortfolio === 'false') query = query.eq('is_portfolio', false)
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

    // Attach review flags — any email_outreach with needs_review=true and not snoozed
    const rows = (data ?? []) as unknown as Record<string, unknown>[]
    const enriched: Record<string, unknown>[] = rows.map((deal) => ({
      ...deal,
      ...computePendingReview(deal.email_outreach),
    }))

    // ── Portfolio outreach_emails aggregation ────────────────────────────────
    // Portfolio deals (is_portfolio=true) have no outreach_emails of their own.
    // Aggregate from member deals so the "Email Targets" column/card shows
    // the full set of tracked emails for the portfolio.
    if (isPortfolio === 'true' && enriched.length > 0) {
      const portfolioDealIds = enriched.map((d) => d.id as string)
      // Find portfolio IDs for these portfolio deals
      const { data: portfolios } = await supabase
        .from('portfolios')
        .select('id, portfolio_deal_id')
        .in('portfolio_deal_id', portfolioDealIds)

      if (portfolios && portfolios.length > 0) {
        const portfolioIdByDealId = new Map<string, string>()
        for (const p of portfolios) {
          portfolioIdByDealId.set(p.portfolio_deal_id, p.id)
        }

        const portfolioIds = Array.from(new Set(portfolios.map((p) => p.id)))
        // Fetch member deals' outreach_emails and email_outreach, grouped by portfolio
        const { data: memberDeals } = await supabase
          .from('deals')
          .select('portfolio_id, outreach_emails, email_outreach(status, needs_review, snoozed_until)')
          .in('portfolio_id', portfolioIds)

        const aggregatedByPortfolio = new Map<string, Set<string>>()
        const aggregatedCountByPortfolio = new Map<string, number>()
        for (const md of (memberDeals ?? [])) {
          const pid = md.portfolio_id as string
          if (!aggregatedByPortfolio.has(pid)) {
            aggregatedByPortfolio.set(pid, new Set())
          }
          const emails = (md.outreach_emails as string[] | null) ?? []
          const set = aggregatedByPortfolio.get(pid)!
          for (const e of emails) {
            if (e) set.add(e.toLowerCase())
          }

          // Aggregate review count
          const mdReview = computePendingReview(md.email_outreach)
          if (mdReview.has_pending_review) {
            aggregatedCountByPortfolio.set(pid, (aggregatedCountByPortfolio.get(pid) ?? 0) + mdReview.pending_review_count)
          }
        }

        // Merge into enriched portfolio deals
        for (const d of enriched) {
          const portfolioId = portfolioIdByDealId.get(d.id as string)
          if (!portfolioId) continue
          const aggregated = aggregatedByPortfolio.get(portfolioId)
          if (aggregated && aggregated.size > 0) {
            const existing = (d.outreach_emails as string[] | null) ?? []
            const merged = new Set([...existing.map((e) => e.toLowerCase()), ...aggregated])
            ;(d as Record<string, unknown>).outreach_emails = Array.from(merged)
          }

          // Merge pending reviews count
          const pendingCount = aggregatedCountByPortfolio.get(portfolioId) ?? 0
          if (pendingCount > 0) {
            ;(d as Record<string, unknown>).has_pending_review = true
            ;(d as Record<string, unknown>).pending_review_count = pendingCount
          }
        }
      }
    }

    return NextResponse.json({ data: enriched, total: count ?? 0, filtered_total: count ?? 0 })
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
    const isPortfolio = searchParams.get('is_portfolio')
    const stage = searchParams.get('stage')
    const score = searchParams.get('score')
    const search = searchParams.get('search')

    // Fetch just the IDs matching the filters
    function idQuery() {
      let q = supabase.from('deals').select('id')
      if (projectId)  q = q.eq('project_id', projectId)
      if (campaignId) q = q.eq('campaign_id', campaignId)
      if (isPortfolio === 'true') q = q.eq('is_portfolio', true)
      else if (isPortfolio === 'false') q = q.eq('is_portfolio', false)
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
