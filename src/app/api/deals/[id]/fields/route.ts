import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('deal_fields')
    .select('value, field_definitions(key, label, data_type)')
    .eq('deal_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const fields: Record<string, { value: string | null; label: string; data_type: string }> = {}
  for (const row of data ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fd = row.field_definitions as any
    const key = fd?.key as string | undefined
    if (key) {
      fields[key] = {
        value: row.value as string | null,
        label: fd?.label as string,
        data_type: fd?.data_type as string,
      }
    }
  }

  return NextResponse.json(fields)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
    return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
  }

  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as Record<string, unknown>

  // Look up the deal's project_id to scope field_definitions correctly.
  // Migration 0021 made field_definitions per-project (UNIQUE key, project_id).
  // Without scoping, the wrong field_id can be used, causing a new deal_fields
  // row to be inserted instead of updating the existing one.
  const { data: deal } = await supabase
    .from('deals')
    .select('project_id')
    .eq('id', id)
    .single()

  const projectId: string | null = deal?.project_id ?? null

  // Fetch project-scoped field_definitions first, global (null project_id) as
  // fallback. Project-scoped defs take priority in the map.
  let defQuery = supabase
    .from('field_definitions')
    .select('id, key, project_id')

  if (projectId) {
    defQuery = defQuery.or(`project_id.eq.${projectId},project_id.is.null`)
  } else {
    defQuery = defQuery.is('project_id', null)
  }

  // Order: non-null project_ids first, nulls last — so project-scoped defs
  // are inserted into the map before global fallbacks.
  const { data: defs, error: defsError } = await defQuery
    .order('project_id', { ascending: true, nullsFirst: false })

  if (defsError) return NextResponse.json({ error: defsError.message }, { status: 500 })

  const defMap = new Map<string, string>()
  for (const d of defs ?? []) {
    const key = d.key as string
    // Don't overwrite — project-scoped defs (first in results) take priority
    if (!defMap.has(key)) {
      defMap.set(key, d.id as string)
    }
  }

  const rows: { deal_id: string; field_id: string; value: string | null }[] = []
  const skipped: string[] = []

  // Blocklist: keys that belong to underwriting, LOI, or deals tables — not deal_fields
  const BLOCKED_FIELD_KEYS = new Set([
    'asking_price', 'price_per_unit', 'purchase_price', 'purchase_price_per_unit',
    'capex', 'capex_per_unit', 'irr', 'irr_pct', 'equity_multiple', 'em',
    'cash_on_cash', 'coc', 'cash_on_cash_pct', 'profit', 'occupancy_pct',
    'population_1mi', 'population_growth_pct', 'rent_growth_12mo_pct',
    'rent_growth_forecast_pct', 'rent_growth_fwd_pct', 'vacancy_rate_pct',
    'market_price_per_unit', 'delta_pct', 'cap_rate', 'underwritability_status',
    'proceed_with_loi', 'loi_recommendation', 'sale_rent_comps', 'uw_notes',
    'offered_price', 'final_price', 'close_date', 'loi_outcome',
    'loi_email', 'last_loi_email_sent_at',
    'stage', 'score', 'portfolio', 'created_at', 'date_added',
    'last_email_sent_on', 'response_type', 'drive_folder_url', 'drive_folder_id',
    'drive_file_count', 'outreach_emails', 'is_archived', 'is_portfolio',
    'deal_room_link', 'docs_count',
    'pl', 'pl_date', 'pnl', 'pnl_date', 'rent_roll', 'rent_roll_date',
    'om', 'tax_bill', 'capex_schedule', 'market_report', 'market_reports',
  ])

  for (const [key, value] of Object.entries(body)) {
    if (BLOCKED_FIELD_KEYS.has(key)) {
      skipped.push(key)
      continue
    }
    const fieldId = defMap.get(key)
    if (!fieldId) {
      skipped.push(key)
      continue
    }
    rows.push({ deal_id: id, field_id: fieldId, value: value === null ? null : String(value) })
  }

  let updated = 0
  if (rows.length > 0) {
    const { error } = await supabase.from('deal_fields')
      .upsert(rows, { onConflict: 'deal_id,field_id' })
    if (error) {
      return NextResponse.json({ ok: false, updated: 0, errors: [error.message], skipped: skipped.length > 0 ? skipped : undefined }, { status: 500 })
    }
    updated = rows.length
  }

  return NextResponse.json({ ok: true, updated, skipped: skipped.length > 0 ? skipped : undefined })
}
