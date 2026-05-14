import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  try {
    if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
      return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
    }

    const { batchId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: job } = await supabase
      .from('import_jobs')
      .update({ status: 'running' })
      .eq('id', batchId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (!job) return NextResponse.json({ error: 'Import job not found' }, { status: 404 })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Import confirm error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
