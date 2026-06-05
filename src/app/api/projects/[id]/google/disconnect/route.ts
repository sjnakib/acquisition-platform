import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cleanupOrphanedConnection } from '@/lib/google/oauth'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
      return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: projectId } = await params

    // Read current connection
    const { data: project } = await supabase
      .from('projects')
      .select('google_connection_id')
      .eq('id', projectId)
      .single()

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const oldConnectionId = project.google_connection_id

    if (!oldConnectionId) {
      return NextResponse.json({ error: 'No Gmail connection to disconnect' }, { status: 400 })
    }

    // Remove reference from project
    await supabase.from('projects')
      .update({ google_connection_id: null })
      .eq('id', projectId)

    // Clean up if orphaned
    await cleanupOrphanedConnection(oldConnectionId)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Disconnect error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
