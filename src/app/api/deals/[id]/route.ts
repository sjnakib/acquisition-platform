import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { patchDealSchema } from '@/lib/validations/deal.schema'
import { canTransition, type DealStage } from '@/lib/stage-machine'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('deals')
      .select(`
        *,
        campaigns(*),
        portfolios!deals_portfolio_id_fkey(id, name),
        portfolio_details:portfolios!portfolio_deal_id(id, name, description),
        contacts(*),
        underwriting(*),
        call_briefs(*),
        loi_records(*),
        document_checklist(*),
        email_outreach(*),
        deal_fields(value, field_definitions(key, label, data_type))
      `)
      .eq('id', id)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // ── Portfolio outreach_emails aggregation ────────────────────────────────
    // For portfolio deals, aggregate outreach_emails from member deals so the
    // Overview tab's "Email Targets" card shows the full set of tracked emails.
    if ((data as Record<string, unknown>).is_portfolio === true) {
      const { data: portfolio } = await supabase
        .from('portfolios')
        .select('id')
        .eq('portfolio_deal_id', id)
        .maybeSingle()

      if (portfolio) {
        const { data: memberDeals } = await supabase
          .from('deals')
          .select('outreach_emails')
          .eq('portfolio_id', portfolio.id)
          .not('outreach_emails', 'eq', '{}')

        const aggregated = new Set<string>()
        const existing = ((data as Record<string, unknown>).outreach_emails as string[] | null) ?? []
        for (const e of existing) {
          if (e) aggregated.add(e.toLowerCase())
        }
        for (const md of (memberDeals ?? [])) {
          const emails = (md.outreach_emails as string[] | null) ?? []
          for (const e of emails) {
            if (e) aggregated.add(e.toLowerCase())
          }
        }
        ;(data as Record<string, unknown>).outreach_emails = Array.from(aggregated)
      }
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Deal get error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
      return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
    }

    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const parsed = patchDealSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    // Stage transition validation
    if (parsed.data.stage) {
      const { data: deal } = await supabase.from('deals').select('stage').eq('id', id).single()
      if (deal) {
        const result = canTransition(deal.stage as DealStage, parsed.data.stage as DealStage)
        if (!result.ok) {
          return NextResponse.json({ error: result.reason }, { status: 422 })
        }
      }
    }

    const { data, error } = await supabase
      .from('deals')
      .update(parsed.data)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('Deal patch error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
      return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
    }

    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { error } = await supabase.from('deals').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Deal delete error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
