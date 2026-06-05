import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createClient } from '@/lib/supabase/server'
import { exchangeCode, getGoogleEmail, getOAuthClient, cleanupOrphanedConnection } from '@/lib/google/oauth'

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code')
    const stateParam = req.nextUrl.searchParams.get('state')

    if (!code) {
      return NextResponse.json({ error: 'No authorization code provided' }, { status: 400 })
    }

    // Decode projectId from OAuth state (handles both base64 and base64url)
    let projectId: string | null = null
    if (stateParam) {
      try {
        const normalized = stateParam.replace(/-/g, '+').replace(/_/g, '/')
        const decoded = JSON.parse(Buffer.from(normalized, 'base64').toString())
        projectId = decoded.projectId ?? null
      } catch {
        console.warn('Failed to decode OAuth state param')
      }
    }

    if (!projectId) {
      return NextResponse.redirect(new URL('/projects?gmail=error&reason=no_project', req.url))
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    // Exchange code for tokens
    const tokens = await exchangeCode(code)

    // Identify the Google account by email
    const googleEmail = await getGoogleEmail(tokens.access_token!)

    // Upsert into google_connections keyed by email
    const { data: existing } = await supabase
      .from('google_connections')
      .select('id')
      .eq('google_email', googleEmail)
      .maybeSingle()

    let connectionId: string

    if (existing) {
      // Update existing connection with fresh tokens
      await supabase.from('google_connections').update({
        access_token: tokens.access_token!,
        refresh_token: tokens.refresh_token ?? null,
        token_type: tokens.token_type ?? null,
        expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        scopes: tokens.scope?.split(' ') ?? null,
      }).eq('id', existing.id)
      connectionId = existing.id
    } else {
      // Insert new connection
      const { data: created, error: insertError } = await supabase
        .from('google_connections')
        .insert({
          google_email: googleEmail,
          access_token: tokens.access_token!,
          refresh_token: tokens.refresh_token ?? null,
          token_type: tokens.token_type ?? null,
          expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
          scopes: tokens.scope?.split(' ') ?? null,
        })
        .select('id')
        .single()

      if (insertError || !created) {
        console.error('Failed to insert google_connection:', insertError)
        return NextResponse.redirect(new URL('/projects?gmail=error', req.url))
      }
      connectionId = created.id
    }

    // Read current project connection (for orphan cleanup)
    const { data: project } = await supabase
      .from('projects')
      .select('google_connection_id')
      .eq('id', projectId)
      .single()

    const oldConnectionId = project?.google_connection_id ?? null

    // Point project to the connection
    await supabase.from('projects')
      .update({ google_connection_id: connectionId })
      .eq('id', projectId)

    // Clean up old connection if orphaned
    if (oldConnectionId && oldConnectionId !== connectionId) {
      await cleanupOrphanedConnection(oldConnectionId)
    }

    // Register Gmail push watch
    try {
      const auth = getOAuthClient()
      auth.setCredentials({ access_token: tokens.access_token })
      const gmail = google.gmail({ version: 'v1', auth })
      const watchRes = await gmail.users.watch({
        userId: 'me',
        requestBody: {
          topicName: `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/topics/gmail-notifications`,
          labelIds: ['INBOX'],
        },
      })

      await supabase.from('google_connections').update({
        last_history_id: watchRes.data.historyId ?? null,
      }).eq('id', connectionId)
    } catch (watchErr) {
      console.error('Failed to register Gmail watch:', watchErr)
      // Non-fatal — watch can be re-registered via refresh-watch
    }

    return NextResponse.redirect(new URL(`/projects/${projectId}/settings?gmail=connected`, req.url))
  } catch (err) {
    console.error('Google callback error:', err)
    return NextResponse.redirect(new URL('/projects?gmail=error', req.url))
  }
}
