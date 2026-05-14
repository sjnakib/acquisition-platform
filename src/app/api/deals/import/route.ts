import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseCoStarFile, type ParsedDeal } from '@/lib/import/costar-parser'

export async function POST(req: NextRequest) {
  try {
    if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
      return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const form = await req.formData()
    const file = form.get('file') as File | null
    const campaignId = form.get('campaign_id') as string | null

    if (!file || !campaignId) {
      return NextResponse.json({ error: 'file and campaign_id required' }, { status: 400 })
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File exceeds 10MB limit' }, { status: 413 })
    }

    const buffer = await file.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    const isZip = bytes[0] === 0x50 && bytes[1] === 0x4B &&
                  bytes[2] === 0x03 && bytes[3] === 0x04
    if (!isZip) {
      return NextResponse.json({ error: 'File must be a valid .xlsx file' }, { status: 415 })
    }

    let deals: ParsedDeal[]
    try {
      deals = await parseCoStarFile(buffer)
    } catch {
      return NextResponse.json({ error: 'Could not parse file. Ensure it is a valid CoStar export.' }, { status: 422 })
    }

    if (deals.length === 0) {
      return NextResponse.json({ error: 'No data rows found in file' }, { status: 422 })
    }

    const { data: job } = await supabase.from('import_jobs').insert({
      campaign_id: campaignId,
      user_id: user.id,
      total_rows: deals.length,
      status: 'pending',
    }).select('id').single()

    if (!job) return NextResponse.json({ error: 'Failed to create import job' }, { status: 500 })

    const batchTag = `${new Date().toISOString().slice(0, 10)}_${campaignId}`

    const preview = await Promise.all(deals.map(async (deal) => {
      let status: 'new' | 'duplicate' | 'invalid' = 'new'
      const missing: string[] = []

      if (!deal.deal_name && !deal.property_id) missing.push('Property Name')
      if (!deal.address) missing.push('Address')

      if (deal.property_id) {
        const { data: existing } = await supabase
          .from('deals')
          .select('id')
          .eq('property_id', deal.property_id)
          .eq('campaign_id', campaignId)
          .maybeSingle()

        if (existing) status = 'duplicate'
      }

      if (missing.length > 0) status = 'invalid'

      return { ...deal, status, missing }
    }))

    return NextResponse.json({ batchId: job.id, preview, batchTag, totalNew: preview.filter((p) => p.status === 'new').length })
  } catch (err) {
    console.error('Import error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
