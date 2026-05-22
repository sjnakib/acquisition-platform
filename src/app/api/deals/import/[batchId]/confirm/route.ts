import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ColumnActionInput } from '@/lib/validations/import.schema'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> },
) {
  if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
    return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()

  const { batchId } = await params
  const { campaign_id, deals, mapping } = await req.json()

  if (!campaign_id || !deals || !Array.isArray(deals)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const columnMapping = (mapping as Record<string, ColumnActionInput> | undefined) ?? {}

  // Look up campaign's project_id so imported deals inherit it
  const { data: campaign } = await adminClient
    .from('campaigns')
    .select('project_id')
    .eq('id', campaign_id)
    .single()
  const projectId = campaign?.project_id ?? null

  const { error: jobError } = await adminClient
    .from('import_jobs')
    .update({ total_rows: deals.length, status: 'running' })
    .eq('id', batchId)

  if (jobError) {
    console.error(jobError)
    return NextResponse.json({ error: 'Failed to update import job' }, { status: 500 })
  }

  // Pre-resolve field_definition IDs for field/new_field actions so we don't
  // query inside the batch loop.
  const fieldIdMap = new Map<string, string>()
  for (const action of Object.values(columnMapping)) {
    if (action.action === 'field' || action.action === 'new_field') {
      const key = action.key
      if (!key || fieldIdMap.has(key)) continue
      const { data: fd } = await adminClient
        .from('field_definitions')
        .select('id')
        .eq('key', key)
        .eq('project_id', projectId)
        .single()
      if (fd) fieldIdMap.set(key, fd.id)
    }
  }

  ;(async () => {
    try {
      const importBatch = `${new Date().toISOString().slice(0, 10)}_${batchId}`
      const cleanedDeals: Record<string, unknown>[] = []
      const rowData: Record<string, unknown>[] = [] // parallel: original rows for custom fields

      for (const deal of deals) {
        const row = deal as Record<string, unknown>
        const cleaned: Record<string, unknown> = {}

        for (const [header, action] of Object.entries(columnMapping)) {
          const raw = row[header]
          if (raw === undefined || raw === null || raw === '') continue

          if (action.action === 'email_target') {
            const existing = (cleaned['outreach_emails'] as string[]) ?? []
            const email = String(raw).trim()
            if (email && email.includes('@')) {
              cleaned['outreach_emails'] = [...existing, email]
            }
          }
          // field / new_field handled separately via deal_fields
        }

        cleanedDeals.push({
          outreach_emails: [],
          ...cleaned,
          campaign_id,
          project_id: projectId,
          import_batch: importBatch,
          created_by: user.id,
        })
        rowData.push(row)
      }

      let inserted = 0
      if (cleanedDeals.length > 0) {
        const BATCH = 500
        for (let i = 0; i < cleanedDeals.length; i += BATCH) {
          const chunk = cleanedDeals.slice(i, i + BATCH)
          const { data: insertedRows, error: dealsError } = await adminClient
            .from('deals')
            .insert(chunk)
            .select('id')

          if (dealsError) throw new Error(dealsError.message)
          inserted += chunk.length

          // Create deal_fields for each inserted deal
          if (insertedRows && insertedRows.length > 0) {
            const dealFields: { deal_id: string; field_id: string; value: string }[] = []

            for (let j = 0; j < insertedRows.length; j++) {
              const dealId = insertedRows[j]!.id as string
              const originalRow = rowData[i + j]

              for (const [header, action] of Object.entries(columnMapping)) {
                if (action.action !== 'field' && action.action !== 'new_field') continue
                const raw = originalRow?.[header]
                if (raw === undefined || raw === null || raw === '') continue

                const fieldId = action.key ? fieldIdMap.get(action.key) : undefined
                if (!fieldId) continue

                dealFields.push({
                  deal_id: dealId,
                  field_id: fieldId,
                  value: String(raw).trim(),
                })
              }
            }

            if (dealFields.length > 0) {
              const { error: dfError } = await adminClient
                .from('deal_fields')
                .insert(dealFields)
              if (dfError) console.error('[import] deal_fields insert error:', dfError)
            }
          }
        }
      }

      await adminClient
        .from('import_jobs')
        .update({ status: 'done', inserted, skipped: deals.length - inserted })
        .eq('id', batchId)
    } catch (err) {
      console.error('[import] Background insert error:', err)
      const message = err instanceof Error ? err.message : 'Unknown error'
      await adminClient
        .from('import_jobs')
        .update({ status: 'failed', inserted: 0, error_log: [message] })
        .eq('id', batchId)
    }
  })()

  return NextResponse.json({ message: 'Import started' })
}
