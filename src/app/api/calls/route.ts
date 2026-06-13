import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createCallBriefSchema } from '@/lib/validations/call.schema'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const projectId = req.nextUrl.searchParams.get('project_id')
    const dealId = req.nextUrl.searchParams.get('deal_id')

    let query = supabase
      .from('call_briefs')
      .select('*, deals!inner(score, project_id, deal_fields(value, field_definitions(key, label, data_type)))')
      .order('flagged_at', { ascending: false })

    if (projectId) query = query.eq('deals.project_id', projectId)
    if (dealId) query = query.eq('deal_id', dealId)

    const { data, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('Calls list error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
      return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const parsed = createCallBriefSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const { deal_id, contact_name, contact_role, phone_number, summary_text } = parsed.data

    const { data, error } = await supabase.from('call_briefs').insert({
      deal_id,
      contact_name,
      contact_role: contact_role ?? null,
      phone_number: phone_number ?? null,
      summary_text,
      flagged_by: user.id,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // v2: no call_scheduled stage — call briefs no longer change deal stage
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('Call create error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
