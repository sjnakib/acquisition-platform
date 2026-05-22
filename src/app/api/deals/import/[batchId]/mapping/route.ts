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

  const { data: job } = await supabase.from('import_jobs').select('source_headers, campaign_id').eq('id', batchId).single()
  if (!job) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })

  // Look up campaign's project_id for field_definitions scoping
  let projectId: string | null = null
  if (job.campaign_id) {
    const { data: campaign } = await supabase.from('campaigns')
      .select('project_id')
      .eq('id', job.campaign_id)
      .single()
    projectId = campaign?.project_id ?? null
  }

  const headers = job.source_headers as string[]
  const errors = validateMapping(headers, mapping)
  if (errors.length > 0) return NextResponse.json({ error: errors.join(' ') }, { status: 422 })

  // Create / surface field definitions for mapped columns
  for (const [, action] of Object.entries(mapping)) {
    if (action.action === 'new_field') {
      const { error: fdError } = await supabase.from('field_definitions').upsert({
        key: action.key,
        label: action.label,
        data_type: action.dataType,
        project_id: projectId,
        show_in_grid: true,
      }, { onConflict: 'key, project_id' })
      if (fdError) console.error('Failed to create field definition:', fdError)
    }
    if (action.action === 'field') {
      // Ensure existing field is surfaced in the grid
      const { error: upError } = await supabase.from('field_definitions')
        .update({ show_in_grid: true })
        .eq('key', action.key)
        .eq('project_id', projectId)
        .eq('show_in_grid', false)
      if (upError) console.error('Failed to surface field definition:', upError)
    }
  }

  // Save mapping on import_jobs
  await supabase.from('import_jobs').update({ column_mapping: mapping }).eq('id', batchId)

  return NextResponse.json({ ok: true, mapping })
}
