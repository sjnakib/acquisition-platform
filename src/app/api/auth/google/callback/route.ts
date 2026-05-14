import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createClient } from '@/lib/supabase/server'
import { exchangeCode } from '@/lib/google/oauth'

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code')
    if (!code) {
      return NextResponse.json({ error: 'No authorization code provided' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    const tokens = await exchangeCode(code)

    await supabase.from('google_tokens').upsert({
      user_id: user.id,
      access_token: tokens.access_token!,
      refresh_token: tokens.refresh_token ?? null,
      token_type: tokens.token_type ?? null,
      expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      scopes: tokens.scope?.split(' ') ?? null,
    }, { onConflict: 'user_id' })

    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!
    )
    auth.setCredentials({ access_token: tokens.access_token })

    const gmail = google.gmail({ version: 'v1', auth })
    const watchRes = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName: `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/topics/gmail-notifications`,
        labelIds: ['INBOX'],
      },
    })

    await supabase.from('google_tokens').update({
      last_history_id: watchRes.data.historyId ?? null,
    }).eq('user_id', user.id)

    return NextResponse.redirect(new URL('/settings?gmail=connected', req.url))
  } catch (err) {
    console.error('Google callback error:', err)
    return NextResponse.redirect(new URL('/settings?gmail=error', req.url))
  }
}
