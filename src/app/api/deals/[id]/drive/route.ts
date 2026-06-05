import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createDealFolder } from '@/lib/google/drive'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
      .select('deal_name, project_id')
      .eq('id', id)
      .single()

    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

    // Resolve Google connection from project
    const { data: project } = await supabase
      .from('projects')
      .select('google_connection_id')
      .eq('id', deal.project_id)
      .single()

    if (!project?.google_connection_id) {
      return NextResponse.json({ error: 'Project not connected to Gmail. Connect in project settings.' }, { status: 400 })
    }

    const { folderUrl } = await createDealFolder(project.google_connection_id, deal.deal_name ?? 'Untitled Deal')

    const { data: updated } = await supabase
      .from('deals')
      .update({ drive_folder_url: folderUrl })
      .eq('id', id)
      .select('drive_folder_url')
      .single()

    return NextResponse.json(updated)
  } catch (err: unknown) {
    console.error('Drive folder error:', err)
    if (err instanceof Error && err.message?.includes('not connected')) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
