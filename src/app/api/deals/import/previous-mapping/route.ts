import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const campaignId = req.nextUrl.searchParams.get('campaign_id')
  if (!campaignId) {
    return NextResponse.json({ error: 'Missing campaign_id' }, { status: 400 })
  }

  const { data: job, error } = await supabase
    .from('import_jobs')
    .select('source_headers, column_mapping')
    .eq('campaign_id', campaignId)
    .not('column_mapping', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!job) {
    return NextResponse.json(null)
  }

  return NextResponse.json({
    source_headers: job.source_headers,
    column_mapping: job.column_mapping,
  })
}
