import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOAuthClient } from '@/lib/google/oauth'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (user.app_metadata?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { user }
}

export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const admin = createAdminClient()
  const { data } = await admin
    .from('google_connections')
    .select('google_email')
    .eq('connection_type', 'system')
    .maybeSingle()

  return NextResponse.json({
    connected: !!data,
    google_email: data?.google_email ?? null,
  })
}

export async function DELETE(req: NextRequest) {
  if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
    return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
  }

  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const admin = createAdminClient()

  // Fetch the system connection
  const { data: conn } = await admin
    .from('google_connections')
    .select('id, access_token')
    .eq('connection_type', 'system')
    .maybeSingle()

  if (!conn) {
    return NextResponse.json({ error: 'No system email connection configured' }, { status: 404 })
  }

  // Revoke the Google token (best-effort)
  try {
    const oauth = getOAuthClient()
    await oauth.revokeToken(conn.access_token)
  } catch {
    // Token may already be expired — non-fatal
  }

  // Delete the connection row
  const { error } = await admin
    .from('google_connections')
    .delete()
    .eq('id', conn.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
