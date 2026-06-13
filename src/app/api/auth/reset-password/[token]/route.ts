import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, verifyUserExistsByEmail } from '@/lib/supabase/admin'
import { passwordResetRateLimit } from '@/lib/rate-limit'
import { executeResetSchema } from '@/lib/validations/password-reset.schema'
import { verifyTurnstile } from '@/lib/turnstile'

function getIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const ip = getIp(req)

  // Rate limit token validation to prevent probing
  const { success: rateLimitOk } = await passwordResetRateLimit.limit(`token:${ip}`)
  if (!rateLimitOk) {
    return NextResponse.json(
      { error: 'rate_limited', message: 'Too many attempts. Try again shortly.' },
      { status: 429 },
    )
  }

  const { token } = await params
  const admin = createAdminClient()

  const { data: reset, error } = await admin
    .from('password_resets')
    .select('email, used, expires_at')
    .eq('token', token)
    .single()

  if (error || !reset) {
    return NextResponse.json(
      { error: 'token_not_found', message: 'This reset link is invalid.' },
      { status: 404 },
    )
  }

  if (reset.used) {
    return NextResponse.json(
      { error: 'token_used', message: 'This reset link has already been used.' },
      { status: 410 },
    )
  }

  if (new Date(reset.expires_at) < new Date()) {
    return NextResponse.json(
      { error: 'token_expired', message: 'This reset link has expired.' },
      { status: 410 },
    )
  }

  // Mask email for display — show first char + domain
  const maskedEmail = maskEmail(reset.email)

  return NextResponse.json({ valid: true, email: maskedEmail })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  // CSRF check
  if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
    return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
  }

  const ip = getIp(req)

  // Rate limit password reset execution
  const { success: rateLimitOk } = await passwordResetRateLimit.limit(`execute:${ip}`)
  if (!rateLimitOk) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again shortly.' },
      { status: 429 },
    )
  }

  const { token } = await params

  // Parse body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = executeResetSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { password, turnstileToken } = parsed.data

  // Verify Turnstile
  const turnstileOk = await verifyTurnstile(turnstileToken, ip)
  if (!turnstileOk) {
    return NextResponse.json(
      { error: 'Bot verification failed. Please try again.' },
      { status: 400 },
    )
  }

  const admin = createAdminClient()

  // Atomically claim the token: mark as used only if currently unused.
  // This prevents a race condition where two concurrent POSTs both pass
  // the read-then-check-then-update sequence.
  const { data: claimed, error: claimErr } = await admin
    .from('password_resets')
    .update({ used: true })
    .eq('token', token)
    .eq('used', false)
    .select('email')
    .single()

  if (claimErr || !claimed) {
    // Token already used, doesn't exist, or expired
    // Check which case to give the right error
    const { data: existing } = await admin
      .from('password_resets')
      .select('used, expires_at')
      .eq('token', token)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json(
        { error: 'This reset link is invalid.' },
        { status: 404 },
      )
    }

    if (existing.used) {
      return NextResponse.json(
        { error: 'This reset link has already been used.' },
        { status: 410 },
      )
    }

    if (new Date(existing.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'This reset link has expired.' },
        { status: 410 },
      )
    }

    return NextResponse.json(
      { error: 'This reset link is invalid.' },
      { status: 404 },
    )
  }

  // Find user ID from email — paginated search through all auth users
  const { exists, userId } = await verifyUserExistsByEmail(claimed.email)

  if (!exists || !userId) {
    return NextResponse.json(
      { error: 'Account not found. Please contact support.' },
      { status: 404 },
    )
  }

  // Update password
  const { error: updateErr } = await admin.auth.admin.updateUserById(
    userId,
    { password },
  )

  if (updateErr) {
    console.error('Failed to update password:', updateErr)
    return NextResponse.json(
      { error: 'Failed to update password. Please try again.' },
      { status: 500 },
    )
  }

  return NextResponse.json({ success: true })
}

/** Mask email for safe display: j***@example.com */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return email
  const visible = local.length > 2 ? 2 : 1
  return local.slice(0, visible) + '***@' + domain
}
