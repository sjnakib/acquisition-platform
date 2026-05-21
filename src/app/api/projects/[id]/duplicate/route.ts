import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { duplicateProjectSchema } from '@/lib/validations/project.schema'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
    return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sourceProjectId } = await params
  const body = await req.json()
  const parsed = duplicateProjectSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  // 1. Fetch source project
  const { data: source, error: sourceErr } = await supabase
    .from('projects')
    .select('*')
    .eq('id', sourceProjectId)
    .single()

  if (sourceErr || !source) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // 2. Create new project
  const { data: newProject, error: createErr } = await supabase
    .from('projects')
    .insert({
      name: parsed.data.name,
      description: source.description,
      created_by: user.id,
    })
    .select()
    .single()

  if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 })

  // 3. Copy field definitions
  const { data: fieldDefs } = await supabase
    .from('field_definitions')
    .select('key, label, data_type, sort_order, show_in_grid')
    .eq('project_id', sourceProjectId)
    .order('sort_order')

  if (fieldDefs?.length) {
    await supabase.from('field_definitions').insert(
      fieldDefs.map((f) => ({ ...f, project_id: newProject.id }))
    )
  }

  // 4. Copy campaigns (structure only, no deals)
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('name, market, listing_type, email_template, email_subject_template, is_active')
    .eq('project_id', sourceProjectId)

  if (campaigns?.length) {
    await supabase.from('campaigns').insert(
      campaigns.map((c) => ({ ...c, project_id: newProject.id }))
    )
  }

  // 5. Copy portfolios (structure only, no deals)
  const { data: portfolios } = await supabase
    .from('portfolios')
    .select('name, description')
    .eq('project_id', sourceProjectId)

  if (portfolios?.length) {
    await supabase.from('portfolios').insert(
      portfolios.map((p) => ({ ...p, project_id: newProject.id }))
    )
  }

  return NextResponse.json(newProject, { status: 201 })
}
