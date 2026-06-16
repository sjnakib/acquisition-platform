import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { patchProjectSchema } from '@/lib/validations/project.schema'
import { cleanupOrphanedConnection } from '@/lib/google/oauth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data, error } = await supabase
    .from('projects')
    .select('*, sponsors(count)')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  if (!data) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  // Fetch deal and campaign counts in parallel
  const [dealCountRes, campaignCountRes] = await Promise.all([
    supabase.from('deals').select('*', { count: 'exact', head: true }).eq('project_id', id),
    supabase.from('campaigns').select('*', { count: 'exact', head: true }).eq('project_id', id),
  ])

  // Optionally fetch Google connection info (table may not exist until migration 0030)
  let googleConn: { google_email: string; token_valid: boolean } | null = null
  const connectionId = (data as Record<string, unknown>).google_connection_id as string | undefined
  if (connectionId) {
    const { data: connData, error: connErr } = await supabase
      .from('google_connections')
      .select('google_email, access_token, refresh_token')
      .eq('id', connectionId)
      .maybeSingle()
    if (!connErr && connData) {
      const c = connData as Record<string, unknown>
      const email = c.google_email as string | null
      const hasTokens = !!(c.access_token || c.refresh_token)
      if (email) {
        googleConn = { google_email: email, token_valid: hasTokens }
      }
    }
  }

  const project = data as unknown as Record<string, unknown>
  return NextResponse.json({
    ...project,
    dealCount: dealCountRes.count,
    campaignCount: campaignCountRes.count,
    google_connections: googleConn,
  })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
    return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = patchProjectSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { name, description, google_connection_id } = parsed.data

  const updates: Record<string, unknown> = {}
  if (name !== undefined) updates.name = name
  if (description !== undefined) updates.description = description

  // Handle google_connection_id: null = disconnect, string = set
  if (google_connection_id !== undefined) {
    // Read current connection for orphan cleanup
    const { data: current } = await supabase
      .from('projects')
      .select('google_connection_id')
      .eq('id', id)
      .single()

    updates.google_connection_id = google_connection_id

    if (current?.google_connection_id && current.google_connection_id !== google_connection_id) {
      await cleanupOrphanedConnection(current.google_connection_id)
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { error: updateError } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
