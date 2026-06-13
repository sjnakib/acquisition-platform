import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createDealFolder, deleteDriveFile } from '@/lib/google/drive'
import { GoogleAuthError } from '@/lib/google/oauth'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
      return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
    }

    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: deal } = await supabase
      .from('deals')
      .select('project_id, deal_fields(value, field_definitions(key))')
      .eq('id', id)
      .single()

    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

    // Resolve Google connection and working folder from project
    const { data: project } = await supabase
      .from('projects')
      .select('google_connection_id, google_drive_folder_id')
      .eq('id', deal.project_id)
      .single()

    if (!project?.google_connection_id) {
      return NextResponse.json(
        { error: 'Project not connected to Gmail. Connect in project settings.' },
        { status: 400 },
      )
    }

    if (!project.google_drive_folder_id) {
      return NextResponse.json(
        { error: 'Working folder not set. Configure in project settings.' },
        { status: 400 },
      )
    }

    type DealFieldRow = { value: string | null; field_definitions: { key: string } | null }
    const dealFields: DealFieldRow[] = (deal.deal_fields as unknown as DealFieldRow[]) ?? []
    const addrField = dealFields.find((f) => f?.field_definitions?.key === 'address')
    const address = addrField?.value ?? 'Untitled Deal'

    const { folderId, folderUrl } = await createDealFolder(
      project.google_connection_id,
      address,
      project.google_drive_folder_id, // parent = working folder
    )

    const { data: updated } = await supabase
      .from('deals')
      .update({ drive_folder_url: folderUrl, drive_folder_id: folderId })
      .eq('id', id)
      .select('drive_folder_url, drive_folder_id')
      .single()

    return NextResponse.json(updated)
  } catch (err: unknown) {
    console.error('Drive folder error:', err)
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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
      return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
    }

    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Get deal's drive folder ID
    const { data: deal } = await supabase
      .from('deals')
      .select('drive_folder_id, project_id')
      .eq('id', id)
      .single()

    if (!deal?.drive_folder_id) {
      return NextResponse.json({ error: 'No deal room to delete' }, { status: 404 })
    }

    // Get project's Google connection for auth
    const { data: project } = await supabase
      .from('projects')
      .select('google_connection_id')
      .eq('id', deal.project_id)
      .single()

    if (!project?.google_connection_id) {
      return NextResponse.json(
        { error: 'Project not connected to Google Drive' },
        { status: 400 },
      )
    }

    // Trash the folder in Google Drive
    await deleteDriveFile(project.google_connection_id, deal.drive_folder_id)

    // Clear the deal's folder references
    await supabase
      .from('deals')
      .update({ drive_folder_id: null, drive_folder_url: null })
      .eq('id', id)

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error('Delete deal room error:', err)
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
