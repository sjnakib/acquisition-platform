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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
      return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
    }

    const auth = await requireAdmin()
    if ('error' in auth) return auth.error

    const { id } = await params
    const supabase = createAdminClient()
    const body = await req.json()

    // Prevent self-demotion: admin cannot change their own role
    if (body.role && id === auth.user.id) {
      return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 })
    }

    const profileUpdates: Record<string, unknown> = {}
    const userMetadataUpdates: Record<string, unknown> = {}

    if (body.role) {
      // Get old role to verify changes and clean up memberships
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', id)
        .single()
      
      const oldRole = currentProfile?.role

      if (oldRole && oldRole !== body.role) {
        // If changed to client, clear team membership assignments
        if (body.role === 'client') {
          await supabase.from('project_members').delete().eq('user_id', id)
        }
        // If changed to internal/admin, clear client sponsor assignments
        if (oldRole === 'client') {
          await supabase.from('sponsors').delete().eq('user_id', id)
        }
      }

      profileUpdates.role = body.role
      await supabase.auth.admin.updateUserById(id, {
        app_metadata: { role: body.role },
      })
    }

    if (body.full_name !== undefined) {
      profileUpdates.full_name = body.full_name
      userMetadataUpdates.full_name = body.full_name
    }

    if (body.hasOwnProperty('client_org')) {
      profileUpdates.client_org = body.client_org
      userMetadataUpdates.client_org = body.client_org
    }

    if (Object.keys(profileUpdates).length > 0) {
      await supabase.from('profiles').update(profileUpdates).eq('id', id)
    }

    if (Object.keys(userMetadataUpdates).length > 0) {
      await supabase.auth.admin.updateUserById(id, {
        user_metadata: userMetadataUpdates,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Admin user patch error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
      return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
    }

    const auth = await requireAdmin()
    if ('error' in auth) return auth.error

    const { id } = await params

    // Prevent self-deletion
    if (id === auth.user.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { error } = await supabase.auth.admin.deleteUser(id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Admin user delete error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
