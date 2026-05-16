import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { loginRateLimit } from '@/lib/rate-limit'
import { loginSchema } from '@/lib/validations/auth.schema'

export async function POST(req: NextRequest) {
  try {
    if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
      return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const { success: rateLimitOk } = await loginRateLimit.limit(ip)
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Too many attempts. Try again in 5 minutes.' }, { status: 429 })
    }

    const body = await req.json()
    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const { email, password, turnstileToken } = parsed.data

    const turnstileRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/turnstile/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'origin': process.env.NEXT_PUBLIC_APP_URL! },
      body: JSON.stringify({ token: turnstileToken }),
    })
    if (!turnstileRes.ok) {
      return NextResponse.json({ error: 'Bot verification failed. Please try again.' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.user) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
    }

    return NextResponse.json({ role: data.user.app_metadata?.role })
  } catch (err) {
    console.error('Login error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
