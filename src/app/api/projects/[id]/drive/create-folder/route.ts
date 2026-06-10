import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createDriveFolder } from '@/lib/google/drive'

/**
 * POST /api/projects/[id]/drive/create-folder
 * Creates a new folder in Google Drive and returns its ID + URL.
 * Body: { name: string, parentFolderId?: string }
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
    const body = (await req.json()) as { name?: string; parentFolderId?: string }
    const { name, parentFolderId } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Folder name is required' }, { status: 400 })
    }

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

    const parentId = parentFolderId || 'root'
    const folder = await createDriveFolder(project.google_connection_id, parentId, name.trim())

    return NextResponse.json(folder, { status: 201 })
  } catch (err) {
    console.error('Create folder error:', err)
    if (err instanceof Error && err.message?.includes('not connected')) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
