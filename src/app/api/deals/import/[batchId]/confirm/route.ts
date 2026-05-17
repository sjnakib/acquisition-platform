import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Fuzzy match source header → v2 system field
function mapHeader(header: string): string | null {
  const h = header.toLowerCase().trim().replace(/\s+/g, ' ')
  if (/^(property|deal)\s*name$/i.test(h)) return 'deal_name'
  if (/^(property|asset)\s*address$/i.test(h)) return 'deal_name' // fallback: use address as deal_name
  if (/^address$/i.test(h)) return 'deal_name' // fallback
  if (/^(number\s*(of\s*)?|#\s*of\s*|total\s*)?units?$/i.test(h)) return 'unit_count'
  if (/^(owner|contact|primary)\s*email$/i.test(h)) return 'outreach_emails'
  if (/^email$/i.test(h)) return 'outreach_emails'
  return null
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
    return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()

  const { batchId } = await params
  const { campaign_id, deals } = await req.json()

  if (!campaign_id || !deals || !Array.isArray(deals)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { error: jobError } = await adminClient.from('import_jobs').update({
    total_rows: deals.length,
    status: 'running',
  }).eq('id', batchId)

  if (jobError) {
    console.error(jobError)
    return NextResponse.json({ error: 'Failed to update import job' }, { status: 500 })
  }

  // Build header map from first row
  const firstRow = deals[0] as Record<string, unknown> | undefined
  const sourceHeaders = firstRow ? Object.keys(firstRow) : []

  // Map source headers → system fields
  const headerMap: Record<string, string> = {}
  for (const h of sourceHeaders) {
    const mapped = mapHeader(h)
    if (mapped) headerMap[h] = mapped
  }

  // If no deal_name mapping found, use the first text column as deal_name
  if (!Object.values(headerMap).includes('deal_name') && sourceHeaders.length > 0) {
    headerMap[sourceHeaders[0]!] = 'deal_name'
  }

  ;(async () => {
    try {
      const cleanedDeals: Record<string, unknown>[] = []
      for (const deal of deals) {
        const row = deal as Record<string, unknown>
        const cleaned: Record<string, unknown> = {}

        for (const [k, v] of Object.entries(row)) {
          const target = headerMap[k]
          if (!target || v === undefined || v === null || v === '') continue

          if (target === 'outreach_emails') {
            // Store emails as array
            const existing = (cleaned['outreach_emails'] as string[]) ?? []
            const email = String(v).trim()
            if (email && email.includes('@')) {
              cleaned['outreach_emails'] = [...existing, email]
            }
          } else if (target === 'unit_count') {
            const num = Number(v)
            if (!isNaN(num) && num > 0) cleaned['unit_count'] = Math.round(num)
          } else {
            cleaned[target] = String(v).trim()
          }
        }

        if (!cleaned['deal_name']) continue

        cleanedDeals.push({
          outreach_emails: [],
          ...cleaned,
          campaign_id,
          import_batch: `${new Date().toISOString().slice(0, 10)}_${batchId}`,
          created_by: user.id,
        })
      }

      let inserted = 0
      if (cleanedDeals.length > 0) {
        const BATCH = 500
        for (let i = 0; i < cleanedDeals.length; i += BATCH) {
          const chunk = cleanedDeals.slice(i, i + BATCH)
          const { error: dealsError } = await adminClient.from('deals').insert(chunk)
          if (dealsError) throw new Error(dealsError.message)
          inserted += chunk.length
        }
      }

      await adminClient.from('import_jobs').update({
        status: 'done',
        inserted,
        skipped: deals.length - inserted,
      }).eq('id', batchId)
    } catch (err) {
      console.error('[import] Background insert error:', err)
      const message = err instanceof Error ? err.message : 'Unknown error'
      await adminClient.from('import_jobs').update({
        status: 'failed',
        inserted: 0,
        error_log: [message],
      }).eq('id', batchId)
    }
  })()

  return NextResponse.json({ message: 'Import started' })
}
