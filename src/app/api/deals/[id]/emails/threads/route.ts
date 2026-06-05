import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getThread } from '@/lib/google/gmail'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const threadId = req.nextUrl.searchParams.get('threadId')
    const dealId = req.nextUrl.searchParams.get('dealId')

    if (!threadId) return NextResponse.json({ error: 'threadId required' }, { status: 400 })
    if (!dealId) return NextResponse.json({ error: 'dealId required' }, { status: 400 })

    // Resolve Google connection from the deal's project
    const { data: deal } = await supabase
      .from('deals')
      .select('project_id')
      .eq('id', dealId)
      .single()

    if (!deal?.project_id) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    const { data: project } = await supabase
      .from('projects')
      .select('google_connection_id')
      .eq('id', deal.project_id)
      .single()

    if (!project?.google_connection_id) {
      return NextResponse.json({ error: 'Project not connected to Gmail. Connect in project settings.' }, { status: 400 })
    }

    const thread = await getThread(project.google_connection_id, threadId)

    const messages = (thread.messages ?? []).map((msg) => {
      const headers: Record<string, string> = {}
      for (const h of msg.payload?.headers ?? []) {
        if (h.name) headers[h.name.toLowerCase()] = h.value ?? ''
      }
      return {
        id: msg.id,
        threadId: msg.threadId,
        snippet: msg.snippet ?? '',
        from: headers['from'] ?? '',
        to: headers['to'] ?? '',
        subject: headers['subject'] ?? '',
        date: headers['date'] ?? '',
        labelIds: msg.labelIds ?? [],
        body: decodeBody(msg.payload),
      }
    })

    return NextResponse.json({ messages, threadId })
  } catch (err) {
    console.error('Thread fetch error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    if (message.includes('Google account not connected')) {
      return NextResponse.json({ error: message }, { status: 401 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function decodeBody(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const p = payload as Record<string, unknown>
  if (p.body && typeof p.body === 'object' && (p.body as Record<string, unknown>).data) {
    return Buffer.from((p.body as Record<string, string>).data ?? '', 'base64').toString('utf-8')
  }
  const parts = p.parts as Array<Record<string, unknown>> | undefined
  if (parts) {
    for (const part of parts) {
      if (part.mimeType === 'text/html' || part.mimeType === 'text/plain') {
        const b = part.body as Record<string, unknown> | undefined
        if (b?.data) return Buffer.from(b.data as string, 'base64').toString('utf-8')
      }
    }
    for (const part of parts) {
      const result = decodeBody(part)
      if (result) return result
    }
  }
  return ''
}
