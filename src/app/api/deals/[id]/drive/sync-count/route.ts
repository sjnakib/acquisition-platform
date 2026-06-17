import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { countAllFilesRecursive } from '@/lib/google/drive'
import { GoogleAuthError } from '@/lib/google/oauth'

/**
 * POST /api/deals/[id]/drive/sync-count
 * Recursively counts all files in the deal's Drive folder and updates
 * drive_file_count in the deals table. Used for initial seeding and
 * periodic reconciliation when the count drifts (e.g. files added
 * directly in Google Drive outside the app).
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

    // Resolve deal and project
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select('project_id, drive_folder_id, drive_file_count')
      .eq('id', dealId)
      .single()

    if (dealError || !deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    if (!deal.drive_folder_id) {
      return NextResponse.json({ drive_file_count: 0, synced: false, reason: 'No deal room' })
    }

    const { data: project, error: projError } = await supabase
      .from('projects')
      .select('google_connection_id')
      .eq('id', deal.project_id)
      .single()

    if (projError || !project?.google_connection_id) {
      return NextResponse.json({ error: 'Gmail not connected' }, { status: 400 })
    }

    const trueCount = await countAllFilesRecursive(project.google_connection_id, deal.drive_folder_id)

    // Update the deals table with the accurate count
    const { error: updateError } = await supabase
      .from('deals')
      .update({ drive_file_count: trueCount })
      .eq('id', dealId)

    if (updateError) {
      console.error('sync-count: failed to update deal', updateError)
      return NextResponse.json({ error: 'Failed to update count' }, { status: 500 })
    }

    return NextResponse.json({
      drive_file_count: trueCount,
      previous_count: deal.drive_file_count,
      synced: true,
    })
  } catch (err) {
    console.error('sync-count error:', err)
    if (err instanceof GoogleAuthError && err.code === 'invalid_grant') {
      return NextResponse.json({
        error: 'google_auth_expired',
        message: 'Google authentication expired. Please reconnect in Settings.',
      }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
