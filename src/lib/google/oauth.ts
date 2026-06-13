import { google } from 'googleapis'
import type { OAuth2Client } from 'google-auth-library'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCachedClient, setCachedClient, invalidateCachedClient } from './auth-cache'

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/contacts.other.readonly',
]

// ---------------------------------------------------------------------------
// Typed error for Google auth failures
// ---------------------------------------------------------------------------

export class GoogleAuthError extends Error {
  constructor(
    message: string,
    public code: 'invalid_grant' | 'not_connected'
  ) {
    super(message)
    this.name = 'GoogleAuthError'
  }

  /** Detect invalid_grant from either a GoogleAuthError or a raw GaxiosError. */
  static isInvalidGrant(err: unknown): boolean {
    if (err instanceof GoogleAuthError && err.code === 'invalid_grant') return true
    if (err && typeof err === 'object') {
      const e = err as { response?: { data?: { error?: string } }; message?: string }
      if (e.response?.data?.error === 'invalid_grant') return true
      if (e.message?.includes('invalid_grant')) return true
    }
    return false
  }
}

// ---------------------------------------------------------------------------
// Connection invalidation
// ---------------------------------------------------------------------------

/**
 * Invalidate a Google connection:
 *  1. Evict the in-memory OAuth2 cache entry.
 *  2. Nullify access_token / refresh_token / expiry in the DB so every
 *     subsequent request fails fast with a typed error instead of hitting
 *     Google's token endpoint again.
 *
 * System connections are logged but NOT auto-invalidated — they require
 * manual admin intervention.
 */
export async function invalidateConnection(connectionId: string): Promise<void> {
  invalidateCachedClient(connectionId)

  const adminClient = createAdminClient()
  const { data: conn } = await adminClient
    .from('google_connections')
    .select('connection_type')
    .eq('id', connectionId)
    .maybeSingle()

  if (conn?.connection_type === 'system') {
    console.error(
      `[oauth] System Google connection ${connectionId} has invalid_grant. ` +
      'Admin must reconnect in admin settings.'
    )
    return
  }

  await adminClient.from('google_connections').update({
    access_token: null,
    refresh_token: null,
    expiry: null,
    updated_at: new Date().toISOString(),
  }).eq('id', connectionId)
}

// ---------------------------------------------------------------------------
// Centralised Google API call wrapper
// ---------------------------------------------------------------------------

/**
 * Execute a Google API call with automatic invalid_grant detection.
 *
 * 1. Gets an authenticated OAuth2 client for the connection.
 * 2. Calls `fn(auth)`.
 * 3. If the call fails with `invalid_grant`, invalidates the connection
 *    and throws a typed `GoogleAuthError` so route handlers can return 401.
 *
 * Prefer this over calling `getAuthedClientByConnection` directly in all
 * gmail.ts, drive.ts, and people.ts functions.
 */
export async function callWithConnection<T>(
  connectionId: string,
  fn: (auth: OAuth2Client) => Promise<T>,
  options?: { useAdminClient?: boolean }
): Promise<T> {
  const auth = await getAuthedClientByConnection(connectionId, options)
  try {
    return await fn(auth)
  } catch (err) {
    if (GoogleAuthError.isInvalidGrant(err)) {
      await invalidateConnection(connectionId)
      throw new GoogleAuthError(
        'Google authentication expired. Please reconnect in Settings.',
        'invalid_grant'
      )
    }
    throw err
  }
}

export function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!
  )
}

export function getAuthUrl(projectId?: string, type?: string) {
  const oauth = getOAuthClient()
  const statePayload = type === 'system'
    ? { type: 'system' }
    : projectId
      ? { projectId }
      : null
  const state = statePayload
    ? Buffer.from(JSON.stringify(statePayload)).toString('base64url')
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
  // Check in-memory cache first (avoids Supabase query on every Drive API call)
  const cached = getCachedClient(connectionId)
  if (cached) return cached

  const supabase = options?.useAdminClient
    ? createAdminClient()
    : await createClient()

  const { data: tokenRow, error } = await supabase
    .from('google_connections')
    .select('*')
    .eq('id', connectionId)
    .single()

  if (error || !tokenRow) {
    throw new GoogleAuthError(
      'Google account not connected. Connect Gmail in settings.',
      'not_connected'
    )
  }

  // If tokens were nullified by a prior invalid_grant, fail fast
  if (!tokenRow.access_token && !tokenRow.refresh_token) {
    throw new GoogleAuthError(
      'Google authentication expired. Please reconnect in Settings.',
      'invalid_grant'
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
      invalidateCachedClient(connectionId)
    } catch (err) {
      console.error('Failed to persist refreshed Google tokens:', err)
    }
  })

  // Proactive refresh: if the token is already expired, refresh now so
  // invalid_grant surfaces before the actual API call rather than mid-operation.
  const creds = oauthClient.credentials
  if (creds.expiry_date && creds.expiry_date <= Date.now()) {
    try {
      await oauthClient.getAccessToken()
    } catch (err) {
      invalidateCachedClient(connectionId)
      if (GoogleAuthError.isInvalidGrant(err)) {
        throw new GoogleAuthError(
          'Google authentication expired. Please reconnect in Settings.',
          'invalid_grant'
        )
      }
      throw err
    }
  }

  setCachedClient(connectionId, oauthClient)
  return oauthClient
}

/**
 * Revoke a Google token and delete the connection row if no project references it.
 * Safe to call after disconnecting a project or changing its google_connection_id.
 */
export async function cleanupOrphanedConnection(connectionId: string): Promise<void> {
  const adminClient = createAdminClient()

  // System connections are never orphaned — they have no project FK
  const { data: conn } = await adminClient
    .from('google_connections')
    .select('connection_type')
    .eq('id', connectionId)
    .maybeSingle()

  if (conn?.connection_type === 'system') return

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

/**
 * Get the system-level Google connection for transactional emails.
 * Returns the connection ID or null if not configured.
 */
export async function getSystemConnectionId(): Promise<string | null> {
  const adminClient = createAdminClient()
  const { data } = await adminClient
    .from('google_connections')
    .select('id')
    .eq('connection_type', 'system')
    .maybeSingle()
  return data?.id ?? null
}
