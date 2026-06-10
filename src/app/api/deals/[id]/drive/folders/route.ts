import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createDriveFolder } from '@/lib/google/drive'

/**
 * POST /api/deals/[id]/drive/folders
 * Creates a subfolder in the deal's Drive folder (or specified parent).
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

    const { id: dealId } = await params
    const body = (await req.json()) as { name?: string; parentFolderId?: string }
    const { name, parentFolderId } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Folder name is required' }, { status: 400 })
    }

    // Resolve deal, project, and connection
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select('project_id, drive_folder_id')
      .eq('id', dealId)
      .single()

    if (dealError || !deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    const { data: project, error: projError } = await supabase
      .from('projects')
      .select('google_connection_id')
      .eq('id', deal.project_id)
      .single()

    if (projError || !project?.google_connection_id) {
      return NextResponse.json({ error: 'Gmail not connected' }, { status: 400 })
    }

    const parentId = parentFolderId ?? deal.drive_folder_id
    if (!parentId) {
      return NextResponse.json({ error: 'Deal folder has not been created yet' }, { status: 400 })
    }

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
