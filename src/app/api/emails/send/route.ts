import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { emailSendRateLimit } from '@/lib/rate-limit'
import { sendEmail } from '@/lib/google/gmail'
import { render } from '@react-email/render'
import OutreachEmail from '@/lib/email/templates/outreach'
import { canTransition, type DealStage } from '@/lib/stage-machine'

async function resolveConnectionId(dealId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data: deal } = await supabase
    .from('deals')
    .select('project_id')
    .eq('id', dealId)
    .single()

  if (!deal?.project_id) return null

  const { data: project } = await supabase
    .from('projects')
    .select('google_connection_id')
    .eq('id', deal.project_id)
    .single()

  return project?.google_connection_id ?? null
}

export async function POST(req: NextRequest) {
  try {
    if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
      return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { success: rateLimitOk } = await emailSendRateLimit.limit(user.id)
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Daily email limit reached (100/day)' }, { status: 429 })
    }

    const { deal_id, contact_id } = await req.json()
    if (!deal_id || !contact_id) {
      return NextResponse.json({ error: 'deal_id and contact_id required' }, { status: 400 })
    }

    const connectionId = await resolveConnectionId(deal_id)
    if (!connectionId) {
      return NextResponse.json({ error: 'Project not connected to Gmail. Connect in project settings.' }, { status: 400 })
    }

    const { data: contact } = await supabase.from('contacts').select('*').eq('id', contact_id).single()
    if (!contact || !contact.email?.length) {
      return NextResponse.json({ error: 'Contact has no email' }, { status: 400 })
    }

    const { data: deal } = await supabase.from('deals').select('*, campaigns(*)').eq('id', deal_id).single()
    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

    const propertyLabel = deal.deal_name ?? 'property'

    const html = await render(
      OutreachEmail({
        ownerName: contact.name ?? 'Owner',
        propertyAddress: propertyLabel,
        senderName: user.email ?? 'Team',
      })
    )

    let result: { messageId: string; threadId: string }
    try {
      result = await sendEmail(connectionId, contact.email[0]!, `Acquisition Inquiry — ${propertyLabel}`, html)
    } catch (err: unknown) {
      const status = err instanceof Error && err.message?.includes('not found') ? 'invalid_address' : 'gmail_error'
      await supabase.from('email_outreach').insert({
        deal_id,
        contact_id,
        status,
        error_message: err instanceof Error ? err.message : 'Unknown error',
        template_used: 'outreach',
      })
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 400 })
    }

    const { data: outreach } = await supabase.from('email_outreach').insert({
      deal_id,
      contact_id,
      status: 'sent',
      sent_at: new Date().toISOString(),
      subject: `Acquisition Inquiry — ${propertyLabel}`,
      template_used: 'outreach',
      gmail_message_id: result.messageId,
      gmail_thread_id: result.threadId,
    }).select().single()

    if (deal.stage === 'lead') {
      const transition = canTransition('lead' as DealStage, 'outreach' as DealStage)
      if (transition.ok) {
        await supabase.from('deals').update({ stage: 'outreach' }).eq('id', deal_id)
      }
    }

    return NextResponse.json(outreach)
  } catch (err) {
    console.error('Email send error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
