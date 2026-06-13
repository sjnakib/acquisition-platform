import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  listDriveFiles,
  uploadFileToDriveStream,
  deleteDriveFile,
  renameDriveFile,
  untrashDriveFile,
  moveDriveFile,
} from '@/lib/google/drive'
import { GoogleAuthError } from '@/lib/google/oauth'

/**
 * GET /api/deals/[id]/drive/files?folderId=...&pageToken=...
 * Lists files and folders in the deal's Drive folder (or a subfolder).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: dealId } = await params
    const folderId = req.nextUrl.searchParams.get('folderId')
    const pageToken = req.nextUrl.searchParams.get('pageToken')

    // Resolve the connection and base folder for this deal
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

    if (projError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (!project.google_connection_id) {
      return NextResponse.json({ error: 'Gmail not connected. Connect in project settings.' }, { status: 400 })
    }

    // If deal has no drive folder yet, return empty
    if (!deal.drive_folder_id) {
      return NextResponse.json({ files: [], nextPageToken: null, dealFolderId: null })
    }

    const targetFolderId = folderId ?? deal.drive_folder_id
    const result = await listDriveFiles(project.google_connection_id, targetFolderId, pageToken)

    return NextResponse.json({
      files: result.files,
      nextPageToken: result.nextPageToken,
      dealFolderId: deal.drive_folder_id,
    })
  } catch (err) {
    console.error('List drive files error:', err)
    if (err instanceof GoogleAuthError && err.code === 'invalid_grant') {
      return NextResponse.json({
        error: 'google_auth_expired',
        message: 'Google authentication expired. Please reconnect in Settings.',
      }, { status: 401 })
    }
    if (err instanceof Error && err.message?.includes('not connected')) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/deals/[id]/drive/files
 * Uploads a file to the deal's Drive folder (or a subfolder).
 * Body: multipart/form-data with "file" and optional "folderId"
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

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const targetFolderId = (formData.get('folderId') as string) ?? null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Resolve deal and project
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
      .select('google_connection_id, google_drive_folder_id')
      .eq('id', deal.project_id)
      .single()

    if (projError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (!project.google_connection_id) {
      return NextResponse.json({ error: 'Gmail not connected' }, { status: 400 })
    }

    // Ensure deal folder exists
    const uploadTargetId = targetFolderId ?? deal.drive_folder_id
    if (!uploadTargetId) {
      return NextResponse.json({ error: 'Deal room has not been created yet. Click "Create Deal Room" first.' }, { status: 400 })
    }

    const result = await uploadFileToDriveStream(
      project.google_connection_id,
      uploadTargetId,
      file.stream(),
      file.name,
      file.type || 'application/octet-stream',
    )

    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    console.error('Upload file error:', err)
    if (err instanceof GoogleAuthError && err.code === 'invalid_grant') {
      return NextResponse.json({
        error: 'google_auth_expired',
        message: 'Google authentication expired. Please reconnect in Settings.',
      }, { status: 401 })
    }
    if (err instanceof Error && err.message?.includes('not connected')) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/deals/[id]/drive/files?fileId=...
 * Trashes a file or folder in Drive.
 */
export async function DELETE(
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
    const fileId = req.nextUrl.searchParams.get('fileId')
    const fileIdsStr = req.nextUrl.searchParams.get('fileIds')

    if (!fileId && !fileIdsStr) {
      return NextResponse.json({ error: 'fileId or fileIds is required' }, { status: 400 })
    }

    // Resolve connection
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select('project_id')
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

    const fileIds = fileIdsStr ? fileIdsStr.split(',') : [fileId!]
    await Promise.all(fileIds.map((id) => deleteDriveFile(project.google_connection_id, id)))

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Delete file error:', err)
    if (err instanceof GoogleAuthError && err.code === 'invalid_grant') {
      return NextResponse.json({
        error: 'google_auth_expired',
        message: 'Google authentication expired. Please reconnect in Settings.',
      }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/deals/[id]/drive/files
 * Renames or restores a file or folder in Drive.
 * Body: { fileId?: string, fileIds?: string[], name?: string, trashed?: boolean, newParentFolderId?: string }
 */
export async function PATCH(
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
    const body = (await req.json()) as { 
      fileId?: string
      fileIds?: string[]
      name?: string
      trashed?: boolean
      newParentFolderId?: string 
    }
    const { fileId, fileIds, name, trashed, newParentFolderId } = body

    if (!fileId && (!fileIds || fileIds.length === 0)) {
      return NextResponse.json({ error: 'fileId or fileIds is required' }, { status: 400 })
    }

    if (
      trashed === undefined &&
      newParentFolderId === undefined &&
      (!name || typeof name !== 'string' || !name.trim())
    ) {
      return NextResponse.json({ error: 'name, trashed, or newParentFolderId parameter is required' }, { status: 400 })
    }

    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select('project_id')
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

    const targetFileIds = fileIds ?? [fileId!]

    if (trashed === false) {
      await Promise.all(targetFileIds.map((id) => untrashDriveFile(project.google_connection_id, id)))
      return NextResponse.json({ success: true })
    }

    if (newParentFolderId) {
      await Promise.all(targetFileIds.map((id) => moveDriveFile(project.google_connection_id, id, newParentFolderId)))
      return NextResponse.json({ success: true })
    }

    if (name && fileId) {
      const renamed = await renameDriveFile(project.google_connection_id, fileId, name.trim())
      return NextResponse.json(renamed)
    }

    return NextResponse.json({ error: 'No valid action specified' }, { status: 400 })
  } catch (err) {
    console.error('Patch file error:', err)
    if (err instanceof GoogleAuthError && err.code === 'invalid_grant') {
      return NextResponse.json({
        error: 'google_auth_expired',
        message: 'Google authentication expired. Please reconnect in Settings.',
      }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
