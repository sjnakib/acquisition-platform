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

    const results: { id: string; field: string; success: boolean; error?: string }[] = []

    for (const update of parsed.data.updates) {
      const fieldSchema = z.object({
        [update.field]: patchDealSchema.shape[update.field as keyof typeof patchDealSchema.shape] ?? z.unknown(),
      })

      const fieldParsed = fieldSchema.safeParse({ [update.field]: update.value })
      if (!fieldParsed.success) {
        results.push({ id: update.id, field: update.field, success: false, error: 'Validation failed' })
        continue
      }

      const { error } = await supabase
        .from('deals')
        .update(fieldParsed.data)
        .eq('id', update.id)

      if (error) {
        results.push({ id: update.id, field: update.field, success: false, error: error.message })
      } else {
        results.push({ id: update.id, field: update.field, success: true })
      }
    }

    const errors = results.filter((r) => !r.success)
    return NextResponse.json({
      updated: results.filter((r) => r.success).length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err) {
    console.error('Batch update error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
