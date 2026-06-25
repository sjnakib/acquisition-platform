import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createCampaignSchema } from '@/lib/validations/campaign.schema'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const projectId = req.nextUrl.searchParams.get('project_id')

    let query = supabase
      .from('campaigns')
      .select('*, deals(id, outreach_emails, email_outreach(status, needs_review, snoozed_until))')
      .order('created_at', { ascending: false })

    if (projectId) query = query.eq('project_id', projectId)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const now = new Date()

    // Flatten campaign fields and count awaiting review replies
    const flattened = (data ?? []).map((c) => {
      const { deals, ...rest } = c as {
        deals: Array<{
          id: string
          outreach_emails: string[] | null
          email_outreach: Array<{ status: string; needs_review: boolean; snoozed_until: string | null }> | null
        }>
        [key: string]: unknown
      }

      let awaitingReviewCount = 0
      for (const d of (deals ?? [])) {
        const outreach = d.email_outreach
        if (outreach?.length) {
          const hasPending = outreach.some((o) => {
            if (!o.needs_review || o.status !== 'replied') return false
            if (o.snoozed_until && new Date(o.snoozed_until) > now) return false
            return true
          })
          if (hasPending) awaitingReviewCount++
        }
      }

      return {
        ...rest,
        deal_count: deals?.length ?? 0,
        awaiting_review_count: awaitingReviewCount,
      }
    })

    return NextResponse.json(flattened)
  } catch (err) {
    console.error('Campaigns list error:', err)
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
    const parsed = createCampaignSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }
    const { data, error } = await supabase.from('campaigns').insert({
      ...parsed.data,
      created_by: user.id,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('Campaign create error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
