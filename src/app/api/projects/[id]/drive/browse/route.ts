import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listDriveFiles } from '@/lib/google/drive'

/**
 * GET /api/projects/[id]/drive/browse?folderId=root&pageToken=...
 * Browse the connected Drive account's folders for the working-folder picker.
 * Only returns folders (mimeType = application/vnd.google-apps.folder).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    // Get project's Google connection
    const { data: project, error } = await supabase
      .from('projects')
      .select('google_connection_id, google_drive_folder_id')
      .eq('id', id)
      .single()

    if (error || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (!project.google_connection_id) {
      return NextResponse.json({ error: 'Gmail not connected' }, { status: 400 })
    }

    const folderId = req.nextUrl.searchParams.get('folderId') ?? 'root'
    const pageToken = req.nextUrl.searchParams.get('pageToken') ?? null

    const result = await listDriveFiles(project.google_connection_id, folderId, pageToken)

    // Filter to only folders for the picker
    const folders = result.files.filter((f) => f.isFolder)

    // Build breadcrumb for navigation
    const breadcrumb: { id: string; name: string }[] = []
    const breadcrumbParam = req.nextUrl.searchParams.get('breadcrumb')
    if (breadcrumbParam) {
      try {
        const parsed = JSON.parse(decodeURIComponent(breadcrumbParam))
        if (Array.isArray(parsed)) breadcrumb.push(...parsed)
      } catch { /* ignore malformed breadcrumb */ }
    }

    return NextResponse.json({
      folders,
      nextPageToken: result.nextPageToken,
      breadcrumb,
      currentFolderId: folderId,
    })
  } catch (err) {
    console.error('Browse Drive error:', err)
    if (err instanceof Error && err.message?.includes('not connected')) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
