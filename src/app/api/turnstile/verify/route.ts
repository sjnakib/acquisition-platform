import { NextRequest, NextResponse } from 'next/server'
import { verifyTurnstile } from '@/lib/turnstile'

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin')
  if (origin !== process.env.NEXT_PUBLIC_APP_URL) {
    return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
  }

  const { token } = await req.json()

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    undefined

  const success = await verifyTurnstile(token, ip)
  if (!success) {
    return NextResponse.json({ success: false }, { status: 400 })
  }
  return NextResponse.json({ success: true })
}
