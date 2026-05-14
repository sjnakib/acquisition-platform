import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin')
  if (origin !== process.env.NEXT_PUBLIC_APP_URL) {
    return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
  }

  const { token } = await req.json()

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
           ?? req.headers.get('x-real-ip')
           ?? undefined

  const res = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: process.env.TURNSTILE_SECRET_KEY!,
        response: token,
        ...(ip && { remoteip: ip }),
      }),
    }
  )

  const data = await res.json()
  if (!data.success) {
    return NextResponse.json({ success: false }, { status: 400 })
  }
  return NextResponse.json({ success: true })
}
