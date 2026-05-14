import { google } from 'googleapis'
import { createClient } from '@/lib/supabase/server'

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/drive.file',
]

export function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!
  )
}

export function getAuthUrl() {
  return getOAuthClient().generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  })
}

export async function exchangeCode(code: string) {
  const { tokens } = await getOAuthClient().getToken(code)
  return tokens
}

export async function getAuthedClient(userId: string) {
  const supabase = await createClient()

  const { data: tokenRow, error } = await supabase
    .from('google_tokens')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error || !tokenRow) {
    throw new Error('Google account not connected. Visit /settings to connect Gmail.')
  }

  const oauthClient = getOAuthClient()
  oauthClient.setCredentials({
    access_token: tokenRow.access_token,
    refresh_token: tokenRow.refresh_token ?? undefined,
    expiry_date: tokenRow.expiry ? new Date(tokenRow.expiry).getTime() : undefined,
  })

  oauthClient.on('tokens', async (tokens) => {
    await supabase.from('google_tokens').update({
      access_token: tokens.access_token ?? tokenRow.access_token,
      expiry: tokens.expiry_date
        ? new Date(tokens.expiry_date).toISOString()
        : tokenRow.expiry,
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId)
  })

  return oauthClient
}
