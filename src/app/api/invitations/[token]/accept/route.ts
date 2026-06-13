import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, verifyUserExistsByEmail } from '@/lib/supabase/admin'
import { loginRateLimit } from '@/lib/rate-limit'
import { acceptInvitationSchema } from '@/lib/validations/invitation.schema'
import { verifyTurnstile } from '@/lib/turnstile'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  // CSRF check
  if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
    return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'

  // Rate limit account creation
  const { success: rateLimitOk } = await loginRateLimit.limit(`invite-accept:${ip}`)
  if (!rateLimitOk) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again in 5 minutes.' },
      { status: 429 },
    )
  }

  const { token } = await params
  const admin = createAdminClient()

  // Validate invitation
  const { data: invitation, error: fetchErr } = await admin
    .from('invitations')
    .select('*')
    .eq('token', token)
    .single()

  if (fetchErr || !invitation) {
    return NextResponse.json(
      { error: 'Invitation not found or already used.' },
      { status: 404 },
    )
  }

  if (invitation.status === 'accepted') {
    return NextResponse.json(
      { error: 'This invitation has already been accepted.' },
      { status: 410 },
    )
  }

  if (invitation.status === 'revoked') {
    return NextResponse.json(
      { error: 'This invitation has been revoked.' },
      { status: 410 },
    )
  }

  if (
    invitation.status === 'expired' ||
    new Date(invitation.expires_at) < new Date()
  ) {
    if (invitation.status === 'pending') {
      await admin
        .from('invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id)
    }
    return NextResponse.json(
      { error: 'This invitation has expired.' },
      { status: 410 },
    )
  }

  if (invitation.status !== 'pending') {
    return NextResponse.json(
      { error: 'Invitation not found or already used.' },
      { status: 404 },
    )
  }

  // Parse and validate body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = acceptInvitationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { name, password, turnstileToken } = parsed.data

  // Verify Turnstile
  const turnstileOk = await verifyTurnstile(turnstileToken, ip)
  if (!turnstileOk) {
    return NextResponse.json(
      { error: 'Bot verification failed. Please try again.' },
      { status: 400 },
    )
  }

  // ── GUARD: prevent duplicate accounts ──
  // Check if an account already exists for this email before calling createUser.
  // The database has a unique constraint on auth.users.email as the ultimate
  // backstop, but this upfront check gives a clean error message instead of
  // relying on parsing createUser's post-hoc error string.
  const { exists: emailAlreadyExists } = await verifyUserExistsByEmail(
    invitation.email,
  )
  if (emailAlreadyExists) {
    return NextResponse.json(
      { error: 'An account with this email already exists.' },
      { status: 409 },
    )
  }

  // Create the auth user
  const { data: newUser, error: createErr } =
    await admin.auth.admin.createUser({
      email: invitation.email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: name,
        role: invitation.role,
      },
    })

  if (createErr) {
    if (createErr.message?.includes('already been registered')) {
      return NextResponse.json(
        { error: 'An account with this email already exists.' },
        { status: 409 },
      )
    }
    console.error('Failed to create user from invitation:', createErr)
    return NextResponse.json(
      { error: 'Failed to create account. Please try again.' },
      { status: 500 },
    )
  }

  const userId = newUser.user.id

  // Update invitation status to accepted rather than deleting it
  await admin
    .from('invitations')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      accepted_by: userId,
    })
    .eq('id', invitation.id)

  // Assign to projects if specified
  const projectIds = (invitation.project_ids as string[]) ?? []
  if (projectIds.length > 0) {
    if (invitation.role === 'internal' || invitation.role === 'admin') {
      await admin.from('project_members').insert(
        projectIds.map((projectId) => ({
          project_id: projectId,
          user_id: userId,
          assigned_by: invitation.invited_by,
        })),
      )
    } else if (invitation.role === 'client') {
      // Check for duplicate sponsor entries first (unique constraint)
      const { data: existingSponsors } = await admin
        .from('sponsors')
        .select('project_id')
        .eq('user_id', userId)
        .in('project_id', projectIds)

      const existingProjectIds = new Set(
        (existingSponsors ?? []).map((s: { project_id: string }) => s.project_id),
      )
      const newProjectIds = projectIds.filter((id) => !existingProjectIds.has(id))

      if (newProjectIds.length > 0) {
        await admin.from('sponsors').insert(
          newProjectIds.map((projectId) => ({
            project_id: projectId,
            user_id: userId,
          })),
        )
      }
    }
  }

  return NextResponse.json({ success: true })
}
