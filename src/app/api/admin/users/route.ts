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

export async function GET(_req: NextRequest) {
  try {
    const auth = await requireAdmin()
    if ('error' in auth) return auth.error

    const supabase = createAdminClient()

    // Fetch all auth users with their profiles
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, client_org, created_at')
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Fetch emails and metadata from auth.users via admin API
    const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers()

    if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })

    // Fetch projects, sponsors, and project members to merge assignments
    const [
      { data: projectsList },
      { data: sponsorsList },
      { data: membersList }
    ] = await Promise.all([
      supabase.from('projects').select('id, name'),
      supabase.from('sponsors').select('id, user_id, project_id'),
      supabase.from('project_members').select('id, user_id, project_id'),
    ])

    const projectMap = new Map(projectsList?.map((p) => [p.id, p.name]) ?? [])
    const authUserMap = new Map(authUsers.map((u) => [u.id, u]))

    const users = profiles.map((p) => {
      const authUser = authUserMap.get(p.id)
      const userProjects: Array<{ id: string; name: string; sponsorId?: string; memberId?: string }> = []

      if (p.role === 'client') {
        const userSponsors = sponsorsList?.filter((s) => s.user_id === p.id) ?? []
        userSponsors.forEach((s) => {
          const name = projectMap.get(s.project_id)
          if (name) {
            userProjects.push({ id: s.project_id, name, sponsorId: s.id })
          }
        })
      } else {
        const userMembers = membersList?.filter((m) => m.user_id === p.id) ?? []
        userMembers.forEach((m) => {
          const name = projectMap.get(m.project_id)
          if (name) {
            userProjects.push({ id: m.project_id, name, memberId: m.id })
          }
        })
      }

      return {
        ...p,
        email: authUser?.email ?? null,
        last_sign_in_at: authUser?.last_sign_in_at ?? null,
        invited_at: authUser?.invited_at ?? null,
        projects: userProjects,
      }
    })

    return NextResponse.json(users)
  } catch (err) {
    console.error('Admin users list error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
