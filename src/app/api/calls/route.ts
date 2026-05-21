import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const projectId = req.nextUrl.searchParams.get('project_id')

    let query = supabase
      .from('call_briefs')
      .select('*, deals!inner(deal_name, score, project_id)')
      .order('flagged_at', { ascending: false })

    if (projectId) query = query.eq('deals.project_id', projectId)

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

    const { deal_id } = await req.json()

    const { data, error } = await supabase.from('call_briefs').insert({
      deal_id,
      flagged_by: user.id,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // v2: no call_scheduled stage — call briefs no longer change deal stage
    return NextResponse.json(data)
  } catch (err) {
    console.error('Call create error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
