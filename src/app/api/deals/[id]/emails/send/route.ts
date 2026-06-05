import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { emailSendRateLimit } from '@/lib/rate-limit'
import { sendEmail, sendReply } from '@/lib/google/gmail'

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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
      return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
    }

    const { id: dealId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { success: rateLimitOk } = await emailSendRateLimit.limit(user.id)
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Daily email limit reached (100/day)' }, { status: 429 })
    }

    const connectionId = await resolveConnectionId(dealId)
    if (!connectionId) {
      return NextResponse.json({ error: 'Project not connected to Gmail. Connect in project settings.' }, { status: 400 })
    }

    const body = await req.json()
    const { contact_id, to, subject, htmlBody, threadId, inReplyTo, cc } = body

    if (!to || !subject || !htmlBody) {
      return NextResponse.json({ error: 'to, subject, and htmlBody required' }, { status: 400 })
    }

    let result: { messageId: string; threadId: string }

    if (threadId && inReplyTo) {
      result = await sendReply(connectionId, threadId, to, subject, htmlBody, inReplyTo, cc)
    } else {
      result = await sendEmail(connectionId, to, subject, htmlBody, cc)
    }

    const { data: outreach, error } = await supabase.from('email_outreach').insert({
      deal_id: dealId,
      status: 'sent',
      sent_at: new Date().toISOString(),
      subject,
      gmail_message_id: result.messageId,
      gmail_thread_id: result.threadId,
      contact_id: contact_id ?? null,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(outreach, { status: 201 })
  } catch (err) {
    console.error('Email send error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    if (message.includes('Google account not connected')) {
      return NextResponse.json({ error: message }, { status: 401 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
