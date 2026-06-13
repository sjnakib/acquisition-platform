import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthedClientByConnection } from '@/lib/google/oauth'
import { google } from 'googleapis'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: dealId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check user role
    const role = user.app_metadata?.role
    if (role !== 'internal' && role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const messageId = req.nextUrl.searchParams.get('messageId')
    const attachmentId = req.nextUrl.searchParams.get('attachmentId')
    const filename = req.nextUrl.searchParams.get('filename') ?? 'attachment'

    if (!messageId || !attachmentId) {
      return NextResponse.json({ error: 'messageId and attachmentId are required' }, { status: 400 })
    }

    // Resolve Google connection from the deal's project
    const { data: deal } = await supabase
      .from('deals')
      .select('project_id')
      .eq('id', dealId)
      .single()

    if (!deal?.project_id) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    const { data: project } = await supabase
      .from('projects')
      .select('google_connection_id')
      .eq('id', deal.project_id)
      .single()

    if (!project?.google_connection_id) {
      return NextResponse.json({ error: 'Project not connected to Gmail.' }, { status: 400 })
    }

    const auth = await getAuthedClientByConnection(project.google_connection_id, { useAdminClient: true })
    const gmail = google.gmail({ version: 'v1', auth })

    // Fetch attachment content from Gmail
    const res = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId,
      id: attachmentId,
    })

    const data = res.data.data
    if (!data) {
      return NextResponse.json({ error: 'Attachment data not found' }, { status: 404 })
    }

    // Decode base64url data to a buffer
    const buffer = Buffer.from(data, 'base64url')

    const headers = new Headers()
    headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`)
    headers.set('Content-Type', 'application/octet-stream')

    return new Response(buffer, {
      status: 200,
      headers,
    })
  } catch (err) {
    console.error('Attachment fetch error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 })
  }
}
