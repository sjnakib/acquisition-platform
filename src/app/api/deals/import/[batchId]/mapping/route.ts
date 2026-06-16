import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mappingSchema } from '@/lib/validations/import.schema'
import { validateMapping } from '@/lib/import/mapping'

export async function POST(req: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
    return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
  }

  const { batchId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = mappingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid mapping', details: parsed.error.flatten() }, { status: 400 })
  }

  const { mapping } = parsed.data
  const bodyProjectId = (body as Record<string, unknown>).project_id as string | undefined

  const { data: job } = await supabase.from('import_jobs').select('source_headers, campaign_id').eq('id', batchId).single()
  if (!job) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })

  // Resolve project_id: prefer explicit body param, fall back to campaign's project_id
  let projectId: string | null = bodyProjectId ?? null
  if (!projectId && job.campaign_id) {
    const { data: campaign } = await supabase.from('campaigns')
      .select('project_id')
      .eq('id', job.campaign_id)
      .single()
    projectId = campaign?.project_id ?? null
  }

  if (!projectId) {
    return NextResponse.json({ error: 'No project_id available — field definitions require project scoping. Provide project_id in request body or assign a project to the campaign.' }, { status: 400 })
  }

  const headers = job.source_headers as string[]
  const errors = validateMapping(headers, mapping)
  if (errors.length > 0) return NextResponse.json({ error: errors.join(' ') }, { status: 422 })

  // Batch-collect field definition operations to avoid N+1 queries
  const warnings: string[] = []
  const newFields: Array<{
    key: string; label: string; data_type: string
    project_id: string; show_in_grid: boolean; source: string
  }> = []
  const fieldKeysToSurface: string[] = []

  // Blocklist: keys that belong to underwriting, LOI, or deals tables — not field_definitions
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

  for (const [, action] of Object.entries(mapping)) {
    if (action.action === 'new_field') {
      if (BLOCKED_FIELD_KEYS.has(action.key)) {
        warnings.push(`Column "${action.label}" maps to a reserved field key "${action.key}". Skipping field creation — this data is managed by the system.`)
        continue
      }
      newFields.push({
        key: action.key,
        label: action.label,
        data_type: action.dataType,
        project_id: projectId,
        show_in_grid: true,
        source: 'import',
      })
    }
    if (action.action === 'field') {
      fieldKeysToSurface.push(action.key)
    }
  }

  // Single batch upsert for all new fields
  if (newFields.length > 0) {
    const { error: fdError } = await supabase
      .from('field_definitions')
      .upsert(newFields, { onConflict: 'key, project_id' })
    if (fdError) {
      console.error('Failed to create field definitions:', fdError)
      warnings.push(`Failed to create ${newFields.length} field definition(s): ${fdError.message}`)
    }
  }

  // Single batch update to surface existing fields in grid
  if (fieldKeysToSurface.length > 0) {
    const { error: upError } = await supabase
      .from('field_definitions')
      .update({ show_in_grid: true })
      .in('key', fieldKeysToSurface)
      .eq('project_id', projectId)
      .eq('show_in_grid', false)
    if (upError) {
      console.error('Failed to surface field definitions:', upError)
      warnings.push(`Failed to surface ${fieldKeysToSurface.length} field(s): ${upError.message}`)
    }
  }

  // Save mapping on import_jobs
  await supabase.from('import_jobs').update({ column_mapping: mapping }).eq('id', batchId)

  return NextResponse.json({ ok: true, mapping, warnings: warnings.length > 0 ? warnings : undefined })
}
