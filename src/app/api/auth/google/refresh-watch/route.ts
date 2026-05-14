import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthedClient } from '@/lib/google/oauth'

export async function GET() {
  try {
    const supabase = createAdminClient()
    const { data: tokens } = await supabase
      .from('google_tokens')
      .select('user_id')

    if (!tokens) return NextResponse.json({ ok: true })

    for (const token of tokens) {
      try {
        const auth = await getAuthedClient(token.user_id)
        const gmail = google.gmail({ version: 'v1', auth })
        const watchRes = await gmail.users.watch({
          userId: 'me',
          requestBody: {
            topicName: `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/topics/gmail-notifications`,
            labelIds: ['INBOX'],
          },
        })
        await supabase.from('google_tokens').update({
          last_history_id: watchRes.data.historyId ?? null,
        }).eq('user_id', token.user_id)
      } catch (err) {
        console.error(`Failed to refresh watch for user ${token.user_id}:`, err)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Refresh watch error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
