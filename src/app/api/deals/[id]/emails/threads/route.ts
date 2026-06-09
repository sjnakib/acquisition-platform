import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getThread, modifyThreadLabels, trashThread, untrashThread, trashMessage, untrashMessage } from '@/lib/google/gmail'

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
        attachments: extractAttachments(msg.payload),
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

interface GmailAttachment {
  attachmentId: string
  filename: string
  mimeType: string
  size: number
}

function extractAttachments(payload: unknown): GmailAttachment[] {
  if (!payload || typeof payload !== 'object') return []
  const p = payload as Record<string, unknown>
  const attachments: GmailAttachment[] = []

  if (p.filename && typeof p.filename === 'string' && p.filename.length > 0) {
    const body = p.body as Record<string, unknown> | undefined
    if (body && body.attachmentId && typeof body.attachmentId === 'string') {
      attachments.push({
        attachmentId: body.attachmentId,
        filename: p.filename,
        mimeType: (p.mimeType as string) ?? 'application/octet-stream',
        size: (body.size as number) ?? 0,
      })
    }
  }

  const parts = p.parts as Array<Record<string, unknown>> | undefined
  if (parts && Array.isArray(parts)) {
    for (const part of parts) {
      attachments.push(...extractAttachments(part))
    }
  }

  return attachments
}

function decodeBody(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const p = payload as Record<string, unknown>
  if (p.body && typeof p.body === 'object' && (p.body as Record<string, unknown>).data) {
    return Buffer.from((p.body as Record<string, string>).data ?? '', 'base64url').toString('utf-8')
  }
  const parts = p.parts as Array<Record<string, unknown>> | undefined
  if (parts) {
    // 1. Prioritize HTML parts directly inside this level
    for (const part of parts) {
      if (part.mimeType === 'text/html') {
        const b = part.body as Record<string, unknown> | undefined
        if (b?.data) return Buffer.from(b.data as string, 'base64url').toString('utf-8')
      }
    }
    // 2. Fallback to plain text parts directly inside this level
    for (const part of parts) {
      if (part.mimeType === 'text/plain') {
        const b = part.body as Record<string, unknown> | undefined
        if (b?.data) return Buffer.from(b.data as string, 'base64url').toString('utf-8')
      }
    }
    // 3. Recurse into nested parts
    for (const part of parts) {
      const result = decodeBody(part)
      if (result) return result
    }
  }
  return ''
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
      return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
    }

    const { id: dealId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check role from JWT app_metadata
    const role = user.app_metadata?.role
    if (role !== 'internal') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await req.json()
    const { threadId, threadIds, action, snoozedUntil, messageId } = body

    const ids: string[] = threadIds ?? (threadId ? [threadId] : [])
    if (ids.length === 0) return NextResponse.json({ error: 'threadId or threadIds required' }, { status: 400 })
    if (!action) return NextResponse.json({ error: 'action required' }, { status: 400 })

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
      return NextResponse.json({ error: 'Project not connected to Gmail.' }, { status: 400 })
    }

    const connectionId = project.google_connection_id

    for (const id of ids) {
      switch (action) {
        case 'archive':
          await modifyThreadLabels(connectionId, id, [], ['INBOX'])
          break
        case 'unarchive':
          await modifyThreadLabels(connectionId, id, ['INBOX'], [])
          break
        case 'delete':
          await trashThread(connectionId, id)
          break
        case 'untrash':
        case 'restore':
          await untrashThread(connectionId, id)
          break
        case 'markRead':
          await modifyThreadLabels(connectionId, id, [], ['UNREAD'])
          break
        case 'markUnread':
          await modifyThreadLabels(connectionId, id, ['UNREAD'], [])
          break
        case 'snooze':
          if (!snoozedUntil) {
            return NextResponse.json({ error: 'snoozedUntil required for snooze' }, { status: 400 })
          }
          // Remove from INBOX in Gmail
          await modifyThreadLabels(connectionId, id, [], ['INBOX'])
          // Add record to database
          const { error: dbErr } = await supabase.from('snoozed_threads').upsert({
            project_id: deal.project_id,
            deal_id: dealId,
            thread_id: id,
            snoozed_until: snoozedUntil,
          }, { onConflict: 'project_id,thread_id' })
          if (dbErr) {
            console.error(`Snooze database error for thread ${id}:`, dbErr)
            return NextResponse.json({ error: dbErr.message }, { status: 500 })
          }
          break
        case 'unsnooze':
          // Add back to INBOX
          await modifyThreadLabels(connectionId, id, ['INBOX'], [])
          // Delete from database
          await supabase.from('snoozed_threads').delete().eq('thread_id', id)
          break
        case 'deleteMessage':
          if (!messageId) {
            return NextResponse.json({ error: 'messageId required for deleteMessage' }, { status: 400 })
          }
          await trashMessage(connectionId, messageId)
          break
        case 'untrashMessage':
          if (!messageId) {
            return NextResponse.json({ error: 'messageId required for untrashMessage' }, { status: 400 })
          }
          await untrashMessage(connectionId, messageId)
          break
        default:
          return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Thread PATCH error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 })
  }
}
