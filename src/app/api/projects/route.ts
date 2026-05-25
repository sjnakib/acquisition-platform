import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createProjectSchema } from '@/lib/validations/project.schema'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const recent = url.searchParams.get('recent') === 'true'

  if (recent) {
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '4', 10), 20)
    const { data, error } = await supabase.rpc('get_recent_projects', { p_limit: limit })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  const { data, error } = await supabase
    .from('projects')
    .select('*, sponsors(count)')
    .order('created_at', { ascending: false })

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
  const parsed = createProjectSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { data, error } = await supabase.from('projects').insert({
    ...parsed.data,
    created_by: user.id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-create essential field definitions for the new project
  const defaultFields = [
    { key: 'deal_name', label: 'Deal Name', data_type: 'text', sort_order: 0, show_in_grid: false },
    { key: 'unit_count', label: 'Units', data_type: 'integer', sort_order: 5, show_in_grid: false },
  ]

  await supabase.from('field_definitions').insert(
    defaultFields.map((f) => ({ ...f, project_id: data.id }))
  )

  return NextResponse.json(data, { status: 201 })
}
