import { render } from '@react-email/render'
import InvitationEmail from '@/lib/email/templates/invitation'
import PasswordResetEmail from '@/lib/email/templates/password-reset'
import { sendEmail } from '@/lib/google/gmail'
import { getSystemConnectionId } from '@/lib/google/oauth'
import { verifyUserExistsByEmail } from '@/lib/supabase/admin'
import { BRAND } from '@/lib/brand'

interface SendInvitationParams {
  inviteeEmail: string
  role: 'internal' | 'client' | 'admin'
  token: string
  expiresAt: string
  invitedByName: string
  message?: string
}

interface SendResult {
  success: boolean
  error?: string
}

const roleLabels: Record<string, string> = {
  internal: 'Team Member',
  client: 'Sponsor',
  admin: 'Administrator',
}

export async function sendInvitationEmail(
  params: SendInvitationParams,
): Promise<SendResult> {
  const { inviteeEmail, role, token, expiresAt, message } = params

  try {
    const connectionId = await getSystemConnectionId()
    if (!connectionId) {
      return {
        success: false,
        error: 'System email not configured. Connect a Gmail account in Admin Panel.',
      }
    }

    const acceptUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}`
    const roleLabel = roleLabels[role] ?? role

    const html = await render(
      InvitationEmail({
        inviteeEmail,
        role,
        brandName: BRAND.name,
        brandDescription: BRAND.description,
        acceptUrl,
        expiresAt,
        message,
      }),
    )

    const subject = `You've been invited to ${BRAND.name} as a ${roleLabel}`

    await sendEmail(connectionId, inviteeEmail, subject, html)

    return { success: true }
  } catch (err) {
    console.error('sendInvitationEmail error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to send invitation email',
    }
  }
}

interface SendPasswordResetParams {
  email: string
  token: string
  expiresAt: string
  requestIp?: string
  requestLocation?: string
}

export async function sendPasswordResetEmail(
  params: SendPasswordResetParams,
): Promise<SendResult> {
  const { email, token, expiresAt, requestIp, requestLocation } = params

  // ── HARD BACKSTOP: verify user exists before sending ──
  // This is the last line of defense. Even if the calling route handler
  // has a bug, this check prevents sending reset emails to non-accounts.
  const { exists } = await verifyUserExistsByEmail(email)
  if (!exists) {
    console.log(
      `[sendPasswordResetEmail] BLOCKED — no account exists for "${email}". Email NOT sent.`,
    )
    return {
      success: false,
      error: 'No account found for this email address.',
    }
  }

  try {
    const connectionId = await getSystemConnectionId()
    if (!connectionId) {
      return {
        success: false,
        error: 'System email not configured. Connect a Gmail account in Admin Panel.',
      }
    }

    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password/${token}`

    const html = await render(
      PasswordResetEmail({
        email,
        brandName: BRAND.name,
        brandDescription: BRAND.description,
        resetUrl,
        expiresAt: new Date(expiresAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        requestIp,
        requestLocation,
      }),
    )

    const subject = `Reset your ${BRAND.name} password`

    await sendEmail(connectionId, email, subject, html)

    return { success: true }
  } catch (err) {
    console.error('sendPasswordResetEmail error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to send password reset email',
    }
  }
}
