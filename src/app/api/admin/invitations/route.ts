import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, verifyUserExistsByEmail } from '@/lib/supabase/admin'
import { emailSendRateLimit } from '@/lib/rate-limit'
import { createInvitationSchema } from '@/lib/validations/invitation.schema'
import { sendInvitationEmail } from '@/lib/email/send'

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

    // Rate limit invitation creation
    const { success: rateLimitOk } = await emailSendRateLimit.limit(`invite:${auth.user.id}`)
    if (!rateLimitOk) {
      return NextResponse.json(
        { error: 'Daily invitation limit reached. Try again tomorrow.' },
        { status: 429 },
      )
    }

    const admin = createAdminClient()
    const body = await req.json()
    const parsed = createInvitationSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { email, role, projectIds, expiresInHours, message } = parsed.data

    // Check if user with this email already exists
    const { exists: alreadyExists } = await verifyUserExistsByEmail(email)
    if (alreadyExists) {
      return NextResponse.json(
        { error: 'A user with this email already has an account.' },
        { status: 409 },
      )
    }

    // Check for duplicate pending invitation
    const { data: pendingInvite } = await admin
      .from('invitations')
      .select('id')
      .eq('email', email)
      .eq('status', 'pending')
      .maybeSingle()

    if (pendingInvite) {
      return NextResponse.json(
        { error: 'A pending invitation already exists for this email. Revoke it first before sending a new one.' },
        { status: 409 },
      )
    }

    // Generate token and expiry
    const token = crypto.randomUUID()
    const expiresAt = new Date(
      Date.now() + expiresInHours * 60 * 60 * 1000,
    ).toISOString()

    // Insert invitation
    const { data: invitation, error: insertErr } = await admin
      .from('invitations')
      .insert({
        email,
        role,
        token,
        status: 'pending',
        project_ids: projectIds,
        invited_by: auth.user.id,
        expires_at: expiresAt,
        message: message ?? null,
      })
      .select()
      .single()

    if (insertErr) {
      console.error('Failed to create invitation:', insertErr)
      return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 })
    }

    // Send branded email
    const emailResult = await sendInvitationEmail({
      inviteeEmail: email,
      role,
      token,
      expiresAt: new Date(expiresAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      invitedByName: auth.user.user_metadata?.full_name ?? 'Admin',
      message,
    })

    const acceptUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}`

    return NextResponse.json(
      {
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          expiresAt: invitation.expires_at,
          acceptUrl,
        },
        emailSent: emailResult.success,
        ...(emailResult.error ? { emailError: emailResult.error } : {}),
      },
      { status: 201 },
    )
  } catch (err) {
    console.error('Create invitation error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin()
    if ('error' in auth) return auth.error

    const admin = createAdminClient()
    const url = new URL(req.url)
    const statusFilter = url.searchParams.get('status')

    // Auto-update expired pending invitations
    await admin
      .from('invitations')
      .update({ status: 'expired' })
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString())

    // Prune extremely old invitations (e.g. created more than 30 days ago) to keep the DB clean
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    await admin
      .from('invitations')
      .delete()
      .lt('created_at', thirtyDaysAgo)

    let query = admin
      .from('invitations')
      .select('*')
      .order('created_at', { ascending: false })

    if (statusFilter) {
      query = query.eq('status', statusFilter)
    }

    const { data: invitations, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Enrich with invited_by name
    const userIds = [...new Set((invitations ?? []).map((i: { invited_by: string }) => i.invited_by))]
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds)

    const nameById = new Map(
      (profiles ?? []).map((p: { id: string; full_name: string | null }) => [
        p.id,
        p.full_name ?? 'Unknown',
      ]),
    )

    const enriched = (invitations ?? []).map((inv: { invited_by: string }) => ({
      ...inv,
      invited_by_name: nameById.get(inv.invited_by) ?? 'Unknown',
    }))

    return NextResponse.json(enriched)
  } catch (err) {
    console.error('List invitations error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
