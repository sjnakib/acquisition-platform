import { OAuth2Client } from 'google-auth-library'
import { google } from 'googleapis'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthedClient } from '@/lib/google/oauth'
import { NextRequest, NextResponse } from 'next/server'

const pubsubClient = new OAuth2Client()

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.replace('Bearer ', '')

    try {
      const ticket = await pubsubClient.verifyIdToken({
        idToken: token,
        audience: `${process.env.NEXT_PUBLIC_APP_URL}/api/emails/webhook`,
      })
      const payload = ticket.getPayload()
      if (payload?.email !== 'gmail-api-push@system.gserviceaccount.com') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const body = await req.json()
    const messageData = Buffer.from(body.message.data, 'base64').toString()
    const notification = JSON.parse(messageData) as { emailAddress: string; historyId: string }

    const supabase = createAdminClient()
    const { data: tokenRow } = await supabase
      .from('google_tokens')
      .select('user_id, last_history_id')
      .single()

    if (!tokenRow) return NextResponse.json({ ok: true })

    const auth = await getAuthedClient(tokenRow.user_id)
    const gmailClient = google.gmail({ version: 'v1', auth })

    const historyRes = await gmailClient.users.history.list({
      userId: 'me',
      startHistoryId: tokenRow.last_history_id ?? notification.historyId,
      historyTypes: ['messageAdded'],
      labelId: 'INBOX',
    })

    for (const historyItem of historyRes.data.history ?? []) {
      for (const msg of historyItem.messagesAdded ?? []) {
        const threadId = msg.message?.threadId
        if (!threadId) continue

        const { data: outreach } = await supabase
          .from('email_outreach')
          .select('id, status')
          .eq('gmail_thread_id', threadId)
          .single()

        if (outreach && outreach.status === 'sent') {
          await supabase.from('email_outreach').update({
            status: 'replied',
            responded_at: new Date().toISOString(),
          }).eq('id', outreach.id)
        }
      }
    }

    await supabase.from('google_tokens').update({
      last_history_id: notification.historyId,
    }).eq('user_id', tokenRow.user_id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
