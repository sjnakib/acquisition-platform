import { google } from 'googleapis'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/contacts.other.readonly',
]

export function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!
  )
}

export function getAuthUrl(projectId?: string) {
  const oauth = getOAuthClient()
  const state = projectId
    ? Buffer.from(JSON.stringify({ projectId })).toString('base64url')
    : undefined
  return oauth.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    ...(state ? { state } : {}),
  })
}

export async function exchangeCode(code: string) {
  const { tokens } = await getOAuthClient().getToken(code)
  return tokens
}

/** Get the Google account email using the Gmail API (uses existing gmail.modify scope). */
export async function getGoogleEmail(accessToken: string): Promise<string> {
  const oauth = getOAuthClient()
  oauth.setCredentials({ access_token: accessToken })
  const gmail = google.gmail({ version: 'v1', auth: oauth })
  const { data } = await gmail.users.getProfile({ userId: 'me' })
  if (!data.emailAddress) throw new Error('Failed to retrieve Google account email')
  return data.emailAddress
}

/**
 * Get an authenticated Google API client using a google_connections row id.
 * Uses the server client (user-authed, RLS-respecting) for reads by default.
 * Pass `useAdminClient: true` for server-initiated contexts (webhook, refresh-watch).
 *
 * Token refresh events always persist via the admin client to avoid RLS/session issues.
 */
export async function getAuthedClientByConnection(
  connectionId: string,
  options?: { useAdminClient?: boolean }
) {
  const supabase = options?.useAdminClient
    ? createAdminClient()
    : await createClient()

  const { data: tokenRow, error } = await supabase
    .from('google_connections')
    .select('*')
    .eq('id', connectionId)
    .single()

  if (error || !tokenRow) {
    throw new Error(
      'Google account not connected for this project. Connect Gmail in project settings.'
    )
  }

  const oauthClient = getOAuthClient()
  oauthClient.setCredentials({
    access_token: tokenRow.access_token,
    refresh_token: tokenRow.refresh_token ?? undefined,
    expiry_date: tokenRow.expiry ? new Date(tokenRow.expiry).getTime() : undefined,
  })

  // Token refresh persistence — always use admin client (no user session dependency)
  oauthClient.on('tokens', async (tokens) => {
    try {
      const adminClient = createAdminClient()
      await adminClient.from('google_connections').update({
        access_token: tokens.access_token ?? tokenRow.access_token,
        expiry: tokens.expiry_date
          ? new Date(tokens.expiry_date).toISOString()
          : tokenRow.expiry,
        updated_at: new Date().toISOString(),
      }).eq('id', connectionId)
    } catch (err) {
      console.error('Failed to persist refreshed Google tokens:', err)
    }
  })

  return oauthClient
}

/**
 * Revoke a Google token and delete the connection row if no project references it.
 * Safe to call after disconnecting a project or changing its google_connection_id.
 */
export async function cleanupOrphanedConnection(connectionId: string): Promise<void> {
  const adminClient = createAdminClient()

  // Check if any project still references this connection
  const { count, error: countError } = await adminClient
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('google_connection_id', connectionId)

  if (countError) {
    console.error('Failed to check orphan status for connection:', connectionId, countError)
    return
  }

  if (count !== null && count > 0) return // Still referenced — skip cleanup

  // No projects reference this connection — revoke and delete
  try {
    const { data: tokenRow } = await adminClient
      .from('google_connections')
      .select('access_token')
      .eq('id', connectionId)
      .single()

    if (tokenRow?.access_token) {
      const oauth = getOAuthClient()
      try {
        await oauth.revokeToken(tokenRow.access_token)
      } catch (err) {
        // Revocation is best-effort — token may already be expired
        console.warn('Token revocation failed (may already be expired):', err)
      }
    }
  } catch (err) {
    console.error('Failed to fetch token for revocation:', err)
  }

  const { error: deleteError } = await adminClient
    .from('google_connections')
    .delete()
    .eq('id', connectionId)

  if (deleteError) {
    console.error('Failed to delete orphaned connection:', connectionId, deleteError)
  }
}
