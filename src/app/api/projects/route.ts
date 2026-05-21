import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createProjectSchema } from '@/lib/validations/project.schema'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

  // Auto-create default field definitions for the new project
  const defaultFields = [
    { key: 'address', label: 'Address', data_type: 'text', sort_order: 10, show_in_grid: true },
    { key: 'city', label: 'City', data_type: 'text', sort_order: 20, show_in_grid: true },
    { key: 'state', label: 'State', data_type: 'text', sort_order: 30, show_in_grid: true },
    { key: 'zip', label: 'Zip Code', data_type: 'text', sort_order: 40, show_in_grid: true },
    { key: 'property_type', label: 'Property Type', data_type: 'text', sort_order: 50, show_in_grid: false },
    { key: 'building_class', label: 'Building Class', data_type: 'text', sort_order: 60, show_in_grid: false },
    { key: 'year_built', label: 'Year Built', data_type: 'integer', sort_order: 70, show_in_grid: false },
    { key: 'property_link', label: 'Property Link', data_type: 'url', sort_order: 80, show_in_grid: false },
  ]

  await supabase.from('field_definitions').insert(
    defaultFields.map((f) => ({ ...f, project_id: data.id }))
  )

  return NextResponse.json(data, { status: 201 })
}
