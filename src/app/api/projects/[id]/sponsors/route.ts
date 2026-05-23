import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { addSponsorSchema } from '@/lib/validations/project.schema'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params

  // Get sponsors
  const { data, error } = await supabase
    .from('sponsors')
    .select('id, user_id, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const sponsorList = data ?? []

  // Batch fetch profiles
  let profileByUserId = new Map<string, string | null>()
  if (sponsorList.length > 0) {
    const userIds = sponsorList.map((s) => s.user_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds)
    profileByUserId = new Map(profiles?.map((p) => [p.id, p.full_name]) ?? [])
  }

  // Batch fetch emails from auth.users via admin client
  const admin = await createAdminClient()
  const { data: { users } } = await admin.auth.admin.listUsers()
  const emailByUserId = new Map(users?.map((u: any) => [u.id, u.email]) ?? [])

  const enriched = sponsorList.map((s) => ({
    id: s.id,
    user_id: s.user_id,
    created_at: s.created_at,
    email: emailByUserId.get(s.user_id) ?? null,
    full_name: profileByUserId.get(s.user_id) ?? null,
  }))

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

  const { id: projectId } = await params
  const body = await req.json()
  const parsed = addSponsorSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { email, full_name } = parsed.data
  const admin = await createAdminClient()

  // Find existing user by email
  let sponsorUserId: string
  const { data: existingUsers } = await admin.auth.admin.listUsers()
  const existing = existingUsers?.users.find(
    (u: any) => u.email?.toLowerCase() === email.toLowerCase()
  )

  if (existing) {
    if (existing.app_metadata?.role === 'internal') {
      return NextResponse.json({ error: 'Internal users cannot be sponsors' }, { status: 400 })
    }
    sponsorUserId = existing.id
  } else {
    // Create new client user
    const tempPassword = crypto.randomUUID().slice(0, 16) + 'Aa1!'
    const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: full_name ?? email.split('@')[0]!, role: 'client' },
      app_metadata: { role: 'client' },
    })
    if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 })
    sponsorUserId = newUser.user.id
  }

  // Link sponsor to project
  const { data, error } = await supabase.from('sponsors').insert({
    project_id: projectId,
    user_id: sponsorUserId,
  }).select().single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'User is already a sponsor for this project' }, { status: 409 })
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

  const { id: projectId } = await params
  const sponsorId = req.nextUrl.searchParams.get('sponsorId')
  if (!sponsorId) {
    return NextResponse.json({ error: 'sponsorId query param is required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('sponsors')
    .delete()
    .eq('id', sponsorId)
    .eq('project_id', projectId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
