import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { emailSendRateLimit } from '@/lib/rate-limit'
import { sendEmail, sendReply, type EmailAttachment } from '@/lib/google/gmail'
import { GoogleAuthError } from '@/lib/google/oauth'

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
    const { contact_id, to, subject, htmlBody, threadId, inReplyTo, cc, bcc, scheduledAt } = body
    const attachment_ids = (body.attachment_ids ?? body.attachments) as string[] | undefined

    if (!to || !subject || !htmlBody) {
      return NextResponse.json({ error: 'to, subject, and htmlBody required' }, { status: 400 })
    }

    // Resolve attachments: download file content from storage
    const gmailAttachments: EmailAttachment[] = []
    if (attachment_ids?.length) {
      for (const attId of attachment_ids) {
        const { data: attachment } = await supabase
          .from('email_attachments')
          .select('*')
          .eq('id', attId)
          .single()

        if (!attachment) continue

        const { data: fileBlob, error: downloadErr } = await supabase.storage
          .from('email-attachments')
          .download(attachment.storage_path)

        if (downloadErr || !fileBlob) continue

        const buffer = Buffer.from(await fileBlob.arrayBuffer())
        gmailAttachments.push({
          filename: attachment.filename,
          mimeType: attachment.mime_type,
          content: buffer,
        })
      }
    }

    let result: { messageId: string; threadId: string } | null = null

    if (!scheduledAt) {
      if (threadId && inReplyTo) {
        result = await sendReply(connectionId, threadId, to, subject, htmlBody, inReplyTo, cc, gmailAttachments, bcc)
      } else {
        result = await sendEmail(connectionId, to, subject, htmlBody, cc, gmailAttachments, bcc, threadId)
      }
    }

    const { data: outreach, error } = await supabase.from('email_outreach').insert({
      deal_id: dealId,
      status: scheduledAt ? 'not_sent' : 'sent',
      sent_at: scheduledAt ? scheduledAt : new Date().toISOString(),
      subject,
      gmail_message_id: result?.messageId ?? null,
      gmail_thread_id: result?.threadId ?? null,
      contact_id: contact_id ?? null,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Update last_email_sent_on when email was actually sent (not just scheduled)
    if (!scheduledAt && result) {
      await supabase.from('deals').update({ last_email_sent_on: new Date().toISOString() }).eq('id', dealId)
    }

    // Check if the email recipient matches one of the Email for LOI addresses, and update last_loi_email_sent_at if so
    if (!scheduledAt && result && to) {
      const recipientEmails = String(to)
        .split(/[,;]/)
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)

      const { data: loiRecord } = await supabase
        .from('loi_records')
        .select('id, loi_email')
        .eq('deal_id', dealId)
        .maybeSingle()

      if (loiRecord?.loi_email) {
        const loiEmails = loiRecord.loi_email
          .split(/[,;]/)
          .map((e: string) => e.trim().toLowerCase())
          .filter(Boolean)

        const hasMatch = recipientEmails.some((email) => loiEmails.includes(email))
        if (hasMatch) {
          await supabase
            .from('loi_records')
            .update({ last_loi_email_sent_at: new Date().toISOString() })
            .eq('id', loiRecord.id)
        }
      }
    }

    // Link attachments to the outreach record
    if (attachment_ids?.length && outreach) {
      await supabase
        .from('email_attachments')
        .update({ email_outreach_id: outreach.id })
        .in('id', attachment_ids as string[])
    }

    return NextResponse.json(outreach, { status: 201 })
  } catch (err) {
    console.error('Email send error:', err)
    if (err instanceof GoogleAuthError && err.code === 'invalid_grant') {
      return NextResponse.json({
        error: 'google_auth_expired',
        message: 'Google authentication expired. Please reconnect in Settings.',
      }, { status: 401 })
    }
    const message = err instanceof Error ? err.message : 'Internal server error'
    if (message.includes('Google account not connected')) {
      return NextResponse.json({ error: message }, { status: 401 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
