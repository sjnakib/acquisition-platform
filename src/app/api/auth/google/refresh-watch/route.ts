import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthedClientByConnection } from '@/lib/google/oauth'

export async function GET() {
  try {
    const supabase = createAdminClient()
    const { data: connections } = await supabase
      .from('google_connections')
      .select('id')

    if (!connections) return NextResponse.json({ ok: true })

    for (const conn of connections) {
      try {
        const auth = await getAuthedClientByConnection(conn.id, { useAdminClient: true })
        const gmail = google.gmail({ version: 'v1', auth })
        const watchRes = await gmail.users.watch({
          userId: 'me',
          requestBody: {
            topicName: `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/topics/gmail-notifications`,
            labelIds: ['INBOX'],
          },
        })
        await supabase.from('google_connections').update({
          last_history_id: watchRes.data.historyId ?? null,
        }).eq('id', conn.id)
      } catch (err) {
        console.error(`Failed to refresh watch for connection ${conn.id}:`, err)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Refresh watch error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
