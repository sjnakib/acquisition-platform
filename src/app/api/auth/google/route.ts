import { NextRequest, NextResponse } from 'next/server'
import { getAuthUrl } from '@/lib/google/oauth'

export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get('projectId') ?? undefined
    const type = req.nextUrl.searchParams.get('type') ?? undefined
    const returnTo = req.nextUrl.searchParams.get('returnTo') ?? undefined
    const url = getAuthUrl(projectId, type, returnTo)
    return NextResponse.redirect(url)
  } catch (err) {
    console.error('Google auth error:', err)
    return NextResponse.json({ error: 'Failed to initiate Google auth' }, { status: 500 })
  }
}
