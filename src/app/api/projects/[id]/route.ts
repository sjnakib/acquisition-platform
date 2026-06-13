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

  // Optionally fetch Google connection email (table may not exist until migration 0030)
  let googleEmail: string | null = null
  const connectionId = (data as Record<string, unknown>).google_connection_id as string | undefined
  if (connectionId) {
    const { data: connData, error: connErr } = await supabase
      .from('google_connections')
      .select('google_email')
      .eq('id', connectionId)
      .maybeSingle()
    if (!connErr && connData) {
      googleEmail = (connData as Record<string, unknown>).google_email as string ?? null
    }
  }

  const project = data as unknown as Record<string, unknown>
  return NextResponse.json({
    ...project,
    dealCount: dealCountRes.count,
    campaignCount: campaignCountRes.count,
    google_connections: googleEmail ? { google_email: googleEmail } : null,
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

  const { data, error } = await supabase
    .from('projects')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
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

  // Read current connection before deleting project (for orphan cleanup)
  const { data: project } = await supabase
    .from('projects')
    .select('google_connection_id')
    .eq('id', id)
    .single()

  const oldConnectionId = project?.google_connection_id ?? null

  const { error } = await supabase.from('projects').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Clean up Google connection if no other project references it
  if (oldConnectionId) {
    await cleanupOrphanedConnection(oldConnectionId)
  }

  return NextResponse.json({ success: true })
}
