import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { batchCreateDriveFolders } from '@/lib/google/drive'

const batchFoldersSchema = z.object({
  folders: z.array(
    z.object({
      name: z.string().min(1, 'Folder name is required'),
      parentPath: z.string().default(''),
    }),
  ).min(1, 'At least one folder is required').max(200, 'Maximum 200 folders per batch'),
  parentFolderId: z.string().min(1, 'parentFolderId is required'),
})

/**
 * POST /api/deals/[id]/drive/folders/batch
 * Creates multiple folders in a single request.
 * Body: { folders: [{ name: string, parentPath: string }], parentFolderId: string }
 * parentPath is relative to parentFolderId (empty string = direct child of parentFolderId).
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

    const body = await req.json()
    const parsed = batchFoldersSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const { folders, parentFolderId } = parsed.data

    // Resolve deal → project → connection (once, not per folder)
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select('project_id, drive_folder_id')
      .eq('id', dealId)
      .single()

    if (dealError || !deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    // Validate parentFolderId is either the deal folder or a subfolder of it
    const effectiveParentId = parentFolderId ?? deal.drive_folder_id
    if (!effectiveParentId) {
      return NextResponse.json(
        { error: 'Deal room has not been created yet. Click "Create Deal Room" first.' },
        { status: 400 },
      )
    }

    const { data: project, error: projError } = await supabase
      .from('projects')
      .select('google_connection_id')
      .eq('id', deal.project_id)
      .single()

    if (projError || !project?.google_connection_id) {
      return NextResponse.json({ error: 'Gmail not connected' }, { status: 400 })
    }

    const result = await batchCreateDriveFolders(
      project.google_connection_id,
      effectiveParentId,
      folders.map((f) => ({
        name: f.name.trim(),
        parentPath: f.parentPath,
      })),
    )

    return NextResponse.json({ folders: result }, { status: 201 })
  } catch (err) {
    console.error('Batch create folders error:', err)
    if (err instanceof Error && err.message?.includes('not connected')) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
