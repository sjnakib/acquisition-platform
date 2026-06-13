import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, verifyUserExistsByEmail } from '@/lib/supabase/admin'
import { passwordResetRateLimit } from '@/lib/rate-limit'
import { requestResetSchema } from '@/lib/validations/password-reset.schema'
import { verifyTurnstile } from '@/lib/turnstile'
import { sendPasswordResetEmail } from '@/lib/email/send'

const RESET_EXPIRY_HOURS = 1

export async function POST(req: NextRequest) {
  try {
    // CSRF origin check
    if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
      return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
    }

    // Rate limit
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const { success: rateLimitOk } = await passwordResetRateLimit.limit(ip)
    if (!rateLimitOk) {
      return NextResponse.json(
        { error: 'Too many attempts. Try again in 15 minutes.' },
        { status: 429 },
      )
    }

    // Parse & validate body
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const parsed = requestResetSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { email, turnstileToken } = parsed.data

    // Verify Turnstile
    const turnstileOk = await verifyTurnstile(turnstileToken, ip)
    if (!turnstileOk) {
      return NextResponse.json(
        { error: 'Bot verification failed. Please try again.' },
        { status: 400 },
      )
    }

    // Per-email rate limit to prevent abuse
    const { success: perEmailOk } = await passwordResetRateLimit.limit(`email:${email}`)
    if (!perEmailOk) {
      return NextResponse.json(
        { error: 'Too many attempts for this email. Try again later.' },
        { status: 429 },
      )
    }

    // ── VERIFY USER EXISTS ──
    const { exists } = await verifyUserExistsByEmail(email)

    if (!exists) {
      console.log(
        `[reset-password] BLOCKED — no account for "${email}".`,
      )
      return NextResponse.json({ sent: false })
    }

    console.log(
      `[reset-password] Account confirmed for "${email}". Sending reset email.`,
    )

    const admin = createAdminClient()

    // Invalidate any existing unused tokens for this email
    await admin
      .from('password_resets')
      .update({ used: true })
      .eq('email', email)
      .eq('used', false)

    // Generate token
    const token = crypto.randomUUID()
    const expiresAt = new Date(
      Date.now() + RESET_EXPIRY_HOURS * 60 * 60 * 1000,
    ).toISOString()

    // Insert token
    const { error: insertErr } = await admin
      .from('password_resets')
      .insert({
        email,
        token,
        expires_at: expiresAt,
      })

    if (insertErr) {
      const e = insertErr as unknown as Record<string, unknown>
      console.error(
        '[reset-password] Failed to insert token:',
        'code:', e.code,
        'message:', e.message,
        'details:', e.details,
        'hint:', e.hint,
      )
      return NextResponse.json(
        { error: 'Failed to process request. Please try again.' },
        { status: 500 },
      )
    }

    // Geolocate the request IP (best-effort, non-blocking)
    let requestLocation: string | undefined
    try {
      const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=city,regionName,country`)
      if (geoRes.ok) {
        const geo = await geoRes.json() as { city?: string; regionName?: string; country?: string }
        const parts = [geo.city, geo.regionName, geo.country].filter(Boolean)
        if (parts.length > 0) requestLocation = parts.join(', ')
      }
    } catch {
      // Geolocation is non-critical — ignore failures
    }

    // Send branded email (best-effort; don't block response on failure)
    await sendPasswordResetEmail({
      email,
      token,
      expiresAt,
      requestIp: ip === 'unknown' ? undefined : ip,
      requestLocation,
    })

    return NextResponse.json({ sent: true })
  } catch (err) {
    console.error('Password reset request error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
