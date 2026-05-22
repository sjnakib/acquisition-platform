import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseFile } from '@/lib/import/file-parser'

export async function POST(req: NextRequest) {
  if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
    return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await req.formData()
  const file = form.get('file') as File | null
  const campaignId = form.get('campaign_id') as string | null
  const portfolioId = form.get('portfolio_id') as string | null

  if (!file || !campaignId) {
    return NextResponse.json({ error: 'file and campaign_id required' }, { status: 400 })
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File exceeds 10MB limit' }, { status: 413 })
  }

  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const isXlsx = file.name.toLowerCase().endsWith('.xlsx')
  if (isXlsx) {
    const isZip = bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04
    if (!isZip) return NextResponse.json({ error: 'File must be a valid .xlsx file' }, { status: 415 })
  }

  let parsed
  try {
    parsed = await parseFile(buffer, file.name)
  } catch {
    return NextResponse.json({ error: 'Could not parse file.' }, { status: 422 })
  }
  if (parsed.rows.length === 0) {
    return NextResponse.json({ error: 'No data rows found in file' }, { status: 422 })
  }

  const { data: campaign } = await supabase.from('campaigns')
    .select('project_id')
    .eq('id', campaignId)
    .single()

  const { data: job } = await supabase.from('import_jobs').insert({
    campaign_id: campaignId,
    project_id: campaign?.project_id ?? null,
    portfolio_id: portfolioId || null,
    user_id: user.id,
    source_headers: parsed.headers,
    total_rows: parsed.rows.length,
    status: 'mapping',
  }).select('id').single()

  return NextResponse.json({
    batchId: job!.id,
    preview: parsed.rows,
    headers: parsed.headers,
    sampleRows: parsed.rows.slice(0, 5),
  })
}
