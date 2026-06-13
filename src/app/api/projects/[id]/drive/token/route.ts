import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOAuthClient } from '@/lib/google/oauth'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/projects/[id]/drive/token
 * Returns a fresh Google access token for the project's connected account.
 * Refreshes the token if expired before returning it.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const { data: project, error } = await supabase
      .from('projects')
      .select('google_connection_id')
      .eq('id', id)
      .single()

    if (error || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (!project.google_connection_id) {
      return NextResponse.json({ error: 'Gmail not connected' }, { status: 400 })
    }

    // Read connection with refresh_token
    const { data: connection, error: connError } = await supabase
      .from('google_connections')
      .select('access_token, refresh_token, expiry')
      .eq('id', project.google_connection_id)
      .single()

    if (connError || !connection) {
      return NextResponse.json({ error: 'Failed to retrieve connection' }, { status: 500 })
    }

    // Refresh if expired
    let accessToken = connection.access_token
    const isExpired = connection.expiry
      ? new Date(connection.expiry).getTime() <= Date.now()
      : false

    if (isExpired && connection.refresh_token) {
      try {
        const oauth = getOAuthClient()
        oauth.setCredentials({
          access_token: connection.access_token,
          refresh_token: connection.refresh_token,
          expiry_date: connection.expiry ? new Date(connection.expiry).getTime() : undefined,
        })
        const { credentials } = await oauth.refreshAccessToken()
        accessToken = credentials.access_token!

        // Persist refreshed token via admin client
        const adminClient = createAdminClient()
        await adminClient.from('google_connections').update({
          access_token: credentials.access_token,
          expiry: credentials.expiry_date
            ? new Date(credentials.expiry_date).toISOString()
            : null,
          updated_at: new Date().toISOString(),
        }).eq('id', project.google_connection_id)
      } catch (refreshErr) {
        console.error('Token refresh failed:', refreshErr)
        return NextResponse.json({
          error: 'google_auth_expired',
          message: 'Google token expired and could not be refreshed. Reconnect Gmail in project settings.',
        }, { status: 401 })
      }
    }

    if (!accessToken) {
      return NextResponse.json({ error: 'No access token available' }, { status: 500 })
    }

    return NextResponse.json({ accessToken })
  } catch (err) {
    console.error('Drive token error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
