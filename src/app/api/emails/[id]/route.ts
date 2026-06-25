import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { canTransition, type DealStage } from '@/lib/stage-machine'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
      return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
    }

    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { error } = await supabase.from('email_outreach').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ deleted: true })
  } catch (err) {
    console.error('Email delete error:', err)
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
    const reviewAction = body.review_action as 'confirm' | 'dismiss' | 'snooze' | undefined

    const allowedFields: Record<string, unknown> = {}
    if (body.response_classification) allowedFields.response_classification = body.response_classification
    if (body.thank_you_sent === true) {
      allowedFields.thank_you_sent = true
      allowedFields.thank_you_sent_at = new Date().toISOString()
    }
    if (body.declination_sent === true) {
      allowedFields.declination_sent = true
      allowedFields.declination_sent_at = new Date().toISOString()
    }
    if (typeof body.conversation_log === 'string') {
      allowedFields.conversation_log = body.conversation_log.slice(0, 5000)
    }

    // Review actions — reply-review-flow
    if (reviewAction === 'confirm') {
      allowedFields.needs_review = false
      allowedFields.response_classification = 'positive'
    } else if (reviewAction === 'dismiss') {
      allowedFields.needs_review = false
    } else if (reviewAction === 'snooze') {
      if (typeof body.snoozed_until === 'string') {
        allowedFields.snoozed_until = body.snoozed_until
      }
    }

    const { data, error } = await supabase
      .from('email_outreach')
      .update(allowedFields)
      .eq('id', id)
      .select('*, deals(stage, is_portfolio, portfolio_id)')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Advance to 'response' on positive or neutral classification (manual)
    if (!reviewAction && (body.response_classification === 'positive' || body.response_classification === 'neutral')) {
      const deals = data.deals as { stage: string } | null
      const dealStage = deals?.stage
      if (dealStage === 'outreach') {
        const transition = canTransition('outreach' as DealStage, 'response' as DealStage)
        if (transition.ok) {
          await supabase.from('deals').update({ stage: 'response' }).eq('id', data.deal_id)
        }
      }
    }

    // Review confirm → advance deal stage, sync portfolio members
    if (reviewAction === 'confirm') {
      const deal = data.deals as { stage: string; is_portfolio: boolean; portfolio_id: string | null } | null
      const dealStage = deal?.stage
      if (dealStage === 'outreach') {
        const transition = canTransition('outreach' as DealStage, 'response' as DealStage)
        if (transition.ok) {
          await supabase.from('deals').update({ stage: 'response' }).eq('id', data.deal_id)

          // Portfolio deal: also advance all non-archived member deals at outreach
          if (deal?.is_portfolio) {
            // Find portfolio row — portfolio deals have NULL portfolio_id;
            // the portfolio is linked via portfolios.portfolio_deal_id
            const { data: portfolio } = await supabase
              .from('portfolios')
              .select('id')
              .eq('portfolio_deal_id', data.deal_id)
              .maybeSingle()

            if (portfolio) {
              const { data: memberDeals } = await supabase
                .from('deals')
                .select('id')
                .eq('portfolio_id', portfolio.id)
                .eq('stage', 'outreach')
                .eq('is_archived', false)

              if (memberDeals?.length) {
                await supabase
                  .from('deals')
                  .update({ stage: 'response' })
                  .in('id', memberDeals.map((d) => d.id))
              }
            }
          }
        }
      }
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Email patch error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
