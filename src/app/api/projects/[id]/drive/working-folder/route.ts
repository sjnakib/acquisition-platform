import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function folderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`
}

/**
 * GET /api/projects/[id]/drive/working-folder
 * Returns the project's working folder info, or null if not set.
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
      .select('google_drive_folder_id, google_drive_folder_url, google_connection_id')
      .eq('id', id)
      .single()

    if (error || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (!project.google_connection_id) {
      return NextResponse.json({ error: 'Gmail not connected' }, { status: 400 })
    }

    if (!project.google_drive_folder_id) {
      return NextResponse.json({ workingFolder: null })
    }

    // Return stored folder info — the folder URL is stable and we don't
    // need to verify via Drive API (avoids scope/permission issues)
    return NextResponse.json({
      workingFolder: {
        folderId: project.google_drive_folder_id,
        folderUrl: project.google_drive_folder_url ?? folderUrl(project.google_drive_folder_id),
        name: project.google_drive_folder_id, // name not needed for display
      },
    })
  } catch (err) {
    console.error('Get working folder error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/projects/[id]/drive/working-folder
 * Sets, updates, or clears the project's working Drive folder.
 * Body: { folderId: string | null } — pass null to clear.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
      return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = (await req.json()) as { folderId?: string | null }
    const folderId = body.folderId

    // Allow clearing the working folder
    if (folderId === null || folderId === undefined) {
      const { error: clearError } = await supabase
        .from('projects')
        .update({ google_drive_folder_id: null, google_drive_folder_url: null })
        .eq('id', id)

      if (clearError) {
        return NextResponse.json({ error: clearError.message }, { status: 500 })
      }
      return NextResponse.json({ workingFolder: null })
    }

    if (typeof folderId !== 'string' || !folderId.trim()) {
      return NextResponse.json({ error: 'folderId must be a non-empty string or null' }, { status: 400 })
    }

    // Get the project's Google connection
    const { data: project, error } = await supabase
      .from('projects')
      .select('google_connection_id')
      .eq('id', id)
      .single()

    if (error || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (!project.google_connection_id) {
      return NextResponse.json({ error: 'Gmail not connected. Connect in project settings first.' }, { status: 400 })
    }

    // Construct the folder URL — Drive folder URLs are stable: https://drive.google.com/drive/folders/{id}
    const url = folderUrl(folderId)

    const { data: updated, error: updateError } = await supabase
      .from('projects')
      .update({
        google_drive_folder_id: folderId,
        google_drive_folder_url: url,
      })
      .eq('id', id)
      .select('google_drive_folder_id, google_drive_folder_url')
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json(updated)
  } catch (err) {
    console.error('Set working folder error:', err)
    if (err instanceof Error && err.message?.includes('not connected')) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
