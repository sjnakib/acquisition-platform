import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('deal_fields')
    .select('value, field_definitions(key, label, data_type)')
    .eq('deal_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const fields: Record<string, { value: string | null; label: string; data_type: string }> = {}
  for (const row of data ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fd = row.field_definitions as any
    const key = fd?.key as string | undefined
    if (key) {
      fields[key] = {
        value: row.value as string | null,
        label: fd?.label as string,
        data_type: fd?.data_type as string,
      }
    }
  }

  return NextResponse.json(fields)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
    return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
  }

  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as Record<string, unknown>

  const { data: defs, error: defsError } = await supabase
    .from('field_definitions')
    .select('id, key')

  if (defsError) return NextResponse.json({ error: defsError.message }, { status: 500 })

  const defMap = new Map<string, string>()
  for (const d of defs ?? []) defMap.set(d.key as string, d.id as string)

  for (const [key, value] of Object.entries(body)) {
    const fieldId = defMap.get(key)
    if (!fieldId) continue
    const strValue = value === null ? null : String(value)
    await supabase.from('deal_fields')
      .upsert({ deal_id: id, field_id: fieldId, value: strValue }, { onConflict: 'deal_id,field_id' })
  }

  return NextResponse.json({ ok: true })
}
