import { NextResponse } from 'next/server'
import { getAuthUrl } from '@/lib/google/oauth'

export async function GET() {
  try {
    const url = getAuthUrl()
    return NextResponse.redirect(url)
  } catch (err) {
    console.error('Google auth error:', err)
    return NextResponse.json({ error: 'Failed to initiate Google auth' }, { status: 500 })
  }
}
