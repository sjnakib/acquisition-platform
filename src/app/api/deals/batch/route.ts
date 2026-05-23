import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { patchDealSchema } from '@/lib/validations/deal.schema'
import { z } from 'zod'

const batchUpdateSchema = z.object({
  updates: z.array(z.object({
    id: z.string().uuid(),
    field: z.string(),
    value: z.unknown(),
  })).min(1).max(500),
})

const CHUNK_SIZE = 500
const batchDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50000),
})

/** Fields that live on the `deals` table — everything else is a dynamic deal_field. */
const SYSTEM_FIELD_KEYS = new Set(Object.keys(patchDealSchema.shape))

export async function DELETE(req: NextRequest) {
  try {
    if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
      return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const parsed = batchDeleteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const ids = parsed.data.ids
    let deleted = 0

    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const chunk = ids.slice(i, i + CHUNK_SIZE)
      const { error } = await supabase.from('deals').delete().in('id', chunk)
      if (error) {
        return NextResponse.json({
          error: error.message,
          deleted,
          remaining: ids.length - deleted,
        }, { status: 500 })
      }
      deleted += chunk.length
    }

    return NextResponse.json({ deleted })
  } catch (err) {
    console.error('Batch delete error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
      return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const parsed = batchUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const updates = parsed.data.updates

    // ── Separate system fields (deals table columns) from dynamic deal_fields ──
    const systemUpdates: { id: string; data: Record<string, unknown> }[] = []
    const fieldUpdates: { id: string; field: string; value: string }[] = []

    for (const u of updates) {
      if (SYSTEM_FIELD_KEYS.has(u.field)) {
        const fieldSchema = z.object({
          [u.field]: patchDealSchema.shape[u.field as keyof typeof patchDealSchema.shape] ?? z.unknown(),
        })
        const fieldParsed = fieldSchema.safeParse({ [u.field]: u.value })
        if (!fieldParsed.success) continue
        systemUpdates.push({ id: u.id, data: fieldParsed.data as Record<string, unknown> })
      } else {
        fieldUpdates.push({ id: u.id, field: u.field, value: String(u.value) })
      }
    }

    const results: { id: string; field: string; success: boolean; error?: string }[] = []

    // ── Process system field updates against deals table ──
    for (const su of systemUpdates) {
      const { error } = await supabase
        .from('deals')
        .update(su.data)
        .eq('id', su.id)

      for (const key of Object.keys(su.data)) {
        results.push({ id: su.id, field: key, success: !error, error: error?.message })
      }
    }

    // ── Process dynamic field updates against deal_fields ──
    if (fieldUpdates.length > 0) {
      // Collect unique deal IDs for batch lookups
      const dealIds = [...new Set(fieldUpdates.map((u) => u.id))]

      // Fetch deal project_ids
      const { data: deals } = await supabase
        .from('deals')
        .select('id, project_id')
        .in('id', dealIds)

      const dealProjectMap = new Map<string, string | null>()
      for (const d of deals ?? []) {
        dealProjectMap.set(d.id as string, d.project_id as string | null)
      }

      // Fetch field_definitions for all relevant projects + global fallback
      const projectIds = [...new Set(deals?.map((d) => d.project_id).filter(Boolean) ?? [])] as string[]
      let fdQuery = supabase.from('field_definitions').select('id, key, project_id')

      if (projectIds.length > 0) {
        const orFilters = projectIds.map((pid) => `project_id.eq.${pid}`).join(',')
        fdQuery = fdQuery.or(`${orFilters},project_id.is.null`)
      } else {
        fdQuery = fdQuery.is('project_id', null)
      }

      const { data: fieldDefs } = await fdQuery
        .order('project_id', { ascending: true, nullsFirst: false })

      const defMap = new Map<string, Map<string, string>>() // project_id|null → key → field_id
      for (const fd of fieldDefs ?? []) {
        const pid = (fd.project_id as string | null) ?? '__global__'
        if (!defMap.has(pid)) defMap.set(pid, new Map())
        const inner = defMap.get(pid)!
        if (!inner.has(fd.key as string)) {
          inner.set(fd.key as string, fd.id as string)
        }
      }

      for (const fu of fieldUpdates) {
        const dealProjectId = dealProjectMap.get(fu.id)
        const projectKey = dealProjectId ?? '__global__'
        const globalKey = '__global__'

        const projectInner = defMap.get(projectKey)
        const globalInner = defMap.get(globalKey)
        const fieldId = projectInner?.get(fu.field) ?? globalInner?.get(fu.field)

        if (!fieldId) {
          results.push({ id: fu.id, field: fu.field, success: false, error: `Unknown field: ${fu.field}` })
          continue
        }

        const { error } = await supabase.from('deal_fields')
          .upsert({ deal_id: fu.id, field_id: fieldId, value: fu.value }, { onConflict: 'deal_id,field_id' })

        results.push({ id: fu.id, field: fu.field, success: !error, error: error?.message })
      }
    }

    const errs = results.filter((r) => !r.success)
    return NextResponse.json({
      updated: results.filter((r) => r.success).length,
      errors: errs.length > 0 ? errs : undefined,
    })
  } catch (err) {
    console.error('Batch update error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
