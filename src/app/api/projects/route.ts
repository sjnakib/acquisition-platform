import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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

  const role = user.app_metadata?.role
  if (role !== 'internal' && role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Detect stale JWT: compare cookie role against canonical DB role.
  // If user's role was changed externally (e.g. admin promotion/demotion),
  // the JWT in the cookie may be out of date. Signal the client to re-auth.
  let canonicalRole = role
  try {
    const adminClient = createAdminClient()
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (profile && profile.role !== role) {
      canonicalRole = profile.role
    }
  } catch { /* non-critical — proceed with JWT role */ }

  if (canonicalRole !== role) {
    return NextResponse.json({
      error: `Your session is out of date. Your role was changed to "${canonicalRole}". Please sign out and sign back in.`,
    }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createProjectSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { data, error } = await supabase.from('projects').insert({
    ...parsed.data,
    created_by: user.id,
  }).select().single()

  if (error) {
    // If RLS error with fresh-looking JWT, something else is wrong
    if (error.message.includes('row-level security')) {
      console.error('RLS insert blocked for user', user.id, 'with role', role, 'canonical', canonicalRole)
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Auto-create essential field definitions for the new project
  const defaultFields = [
    { key: 'address', label: 'Address', data_type: 'text', sort_order: 0, show_in_grid: true },
    { key: 'unit_count', label: 'Units', data_type: 'integer', sort_order: 5, show_in_grid: false },
  ]

  await supabase.from('field_definitions').insert(
    defaultFields.map((f) => ({ ...f, project_id: data.id }))
  )

  // Add creator to project_members so they can see/access the project
  // (admin users see all projects anyway via RLS, but this ensures access
  // if they are ever demoted to internal later)
  await supabase.from('project_members').insert({
    project_id: data.id,
    user_id: user.id,
    assigned_by: user.id,
  })

  return NextResponse.json(data, { status: 201 })
}
