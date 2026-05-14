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
      .select('deal_name')
      .eq('id', id)
      .single()

    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

    const { folderUrl } = await createDealFolder(user.id, deal.deal_name ?? 'Untitled Deal')

    const { data: updated } = await supabase
      .from('deals')
      .update({ drive_folder_url: folderUrl })
      .eq('id', id)
      .select('drive_folder_url')
      .single()

    return NextResponse.json(updated)
  } catch (err: any) {
    console.error('Drive folder error:', err)
    if (err.message?.includes('not connected')) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
