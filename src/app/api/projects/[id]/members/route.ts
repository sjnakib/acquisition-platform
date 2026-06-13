import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, listAllUsers, verifyUserExistsByEmail } from '@/lib/supabase/admin'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = user.app_metadata?.role
  if (role !== 'internal' && role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: projectId } = await params

  // Get project members
  const { data: members, error } = await supabase
    .from('project_members')
    .select('id, user_id, assigned_by, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const memberList = members ?? []

  // Batch fetch profiles
  let profileByUserId = new Map<string, { full_name: string | null; role: string }>()
  if (memberList.length > 0) {
    const userIds = memberList.map((m) => m.user_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('id', userIds)
    profileByUserId = new Map(profiles?.map((p) => [p.id, { full_name: p.full_name, role: p.role }]) ?? [])
  }

  // Batch fetch emails from auth.users via admin client (paginated)
  const users = await listAllUsers()
  const emailByUserId = new Map(users.map((u) => [u.id, u.email]))

  const enriched = memberList.map((m) => {
    const profile = profileByUserId.get(m.user_id)
    return {
      id: m.id,
      user_id: m.user_id,
      assigned_by: m.assigned_by,
      created_at: m.created_at,
      email: emailByUserId.get(m.user_id) ?? null,
      full_name: profile?.full_name ?? null,
      role: profile?.role ?? 'internal',
    }
  })

  return NextResponse.json(enriched)
}

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

  const role = user.app_metadata?.role
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: projectId } = await params
  const body = await req.json()
  const { userId, email } = body

  if (!userId && !email) {
    return NextResponse.json({ error: 'userId or email is required' }, { status: 400 })
  }

  let targetUserId: string = ''

  if (userId) {
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', userId)
      .single()

    if (profileErr || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    if (profile.role === 'client') {
      return NextResponse.json({ error: 'Sponsors cannot be assigned as project members' }, { status: 400 })
    }

    targetUserId = userId
  } else if (email) {
    const admin = createAdminClient()
    const { exists, userId } = await verifyUserExistsByEmail(email)

    if (!exists || !userId) {
      return NextResponse.json({ error: 'User does not exist. Create them in the Admin Panel first.' }, { status: 404 })
    }

    const { data: { user: authUser } } = await admin.auth.admin.getUserById(userId)
    if (authUser?.app_metadata?.role === 'client') {
      return NextResponse.json({ error: 'Sponsors cannot be assigned as project members' }, { status: 400 })
    }

    targetUserId = userId
  }

  // Insert into project_members
  const { data, error } = await supabase
    .from('project_members')
    .insert({
      project_id: projectId,
      user_id: targetUserId,
      assigned_by: user.id,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'User is already a member of this project' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
    return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = user.app_metadata?.role
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: projectId } = await params
  const memberId = req.nextUrl.searchParams.get('memberId')
  const userId = req.nextUrl.searchParams.get('userId')

  if (!memberId && !userId) {
    return NextResponse.json({ error: 'memberId or userId query param is required' }, { status: 400 })
  }

  let query = supabase.from('project_members').delete().eq('project_id', projectId)

  if (memberId) {
    query = query.eq('id', memberId)
  } else if (userId) {
    query = query.eq('user_id', userId)
  }

  const { error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
