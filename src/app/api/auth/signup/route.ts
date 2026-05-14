import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { loginRateLimit } from '@/lib/rate-limit'
import { signupSchema } from '@/lib/validations/auth.schema'

export async function POST(req: NextRequest) {
  try {
    if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
      return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const { success: rateLimitOk } = await loginRateLimit.limit(ip)
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Too many attempts. Try again in 15 minutes.' }, { status: 429 })
    }

    const body = await req.json()
    const parsed = signupSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const { email, password, turnstileToken, fullName, role } = parsed.data

    const turnstileRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/turnstile/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'origin': process.env.NEXT_PUBLIC_APP_URL! },
      body: JSON.stringify({ token: turnstileToken }),
    })
    if (!turnstileRes.ok) {
      return NextResponse.json({ error: 'Bot verification failed. Please try again.' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role },
      },
    })
    if (error || !data.user) {
      return NextResponse.json({ error: error?.message ?? 'Signup failed' }, { status: 400 })
    }

    return NextResponse.json({ role: data.user.app_metadata?.role })
  } catch (err) {
    console.error('Signup error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
