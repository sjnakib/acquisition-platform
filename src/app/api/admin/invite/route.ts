import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (user.app_metadata?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { user }
}

export async function POST(req: NextRequest) {
  try {
    if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
      return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
    }

    const auth = await requireAdmin()
    if ('error' in auth) return auth.error

    const supabase = createAdminClient()
    const body = await req.json()

    const { email, full_name, role, client_org } = body

    // Only admins can create admin accounts; internal users cannot
    if (role === 'admin') {
      // Creating another admin — allowed
    }

    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: { full_name, role, client_org },
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // If creating internal user, auto-assign to all projects
    if (role === 'internal' && data.user) {
      const { data: projects } = await supabase.from('projects').select('id')
      if (projects && projects.length > 0) {
        await supabase.from('project_members').insert(
          projects.map((p: { id: string }) => ({
            project_id: p.id,
            user_id: data.user!.id,
            assigned_by: auth.user.id,
          }))
        )
      }
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Invite error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
