import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: invitation, error } = await admin
    .from('invitations')
    .select('email, role, status, expires_at')
    .eq('token', token)
    .single()

  if (error || !invitation) {
    return NextResponse.json(
      { error: 'invitation_not_found', redirect: '/invite/expired' },
      { status: 404 },
    )
  }

  if (new Date(invitation.expires_at) < new Date()) {
    if (invitation.status === 'pending') {
      await admin
        .from('invitations')
        .update({ status: 'expired' })
        .eq('token', token)
    }
    return NextResponse.json(
      { error: 'expired', redirect: '/invite/expired' },
      { status: 410 },
    )
  }

  if (invitation.status === 'accepted') {
    return NextResponse.json(
      { error: 'already_accepted', redirect: '/login?info=invite_already_accepted' },
      { status: 400 },
    )
  }

  if (invitation.status === 'revoked') {
    return NextResponse.json(
      { error: 'revoked', redirect: '/invite/expired' },
      { status: 400 },
    )
  }

  if (invitation.status !== 'pending') {
    return NextResponse.json(
      { error: 'invitation_not_found', redirect: '/invite/expired' },
      { status: 404 },
    )
  }

  return NextResponse.json({ email: invitation.email, role: invitation.role })
}
