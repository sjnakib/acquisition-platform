import { google } from 'googleapis'
import { getAuthedClientByConnection } from './oauth'

export interface EmailAttachment {
  filename: string
  mimeType: string
  content: Buffer
}

function buildMimeMessage(
  to: string,
  subject: string,
  htmlBody: string,
  cc?: string,
  attachments?: EmailAttachment[],
  bcc?: string,
): string {
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`
  const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`
  const lines: string[] = []

  lines.push(`To: ${to}`)
  if (cc) lines.push(`Cc: ${cc}`)
  if (bcc) lines.push(`Bcc: ${bcc}`)
  lines.push(`Subject: ${utf8Subject}`)
  lines.push('MIME-Version: 1.0')

  if (attachments?.length) {
    lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`)
    lines.push('')
    lines.push(`--${boundary}`)
    lines.push('Content-Type: text/html; charset=utf-8')
    lines.push('')
    lines.push(htmlBody)

    for (const att of attachments) {
      lines.push(`--${boundary}`)
      lines.push(`Content-Type: ${att.mimeType}`)
      lines.push('Content-Transfer-Encoding: base64')
      lines.push(`Content-Disposition: attachment; filename="${att.filename}"`)
      lines.push('')
      lines.push(att.content.toString('base64'))
    }

    lines.push(`--${boundary}--`)
  } else {
    lines.push('Content-Type: text/html; charset=utf-8')
    lines.push('')
    lines.push(htmlBody)
  }

  return lines.join('\n')
}

function encodeMessage(raw: string): string {
  return Buffer.from(raw)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function sendEmail(
  connectionId: string,
  to: string,
  subject: string,
  htmlBody: string,
  cc?: string,
  attachments?: EmailAttachment[],
  bcc?: string,
): Promise<{ messageId: string; threadId: string }> {
  const auth = await getAuthedClientByConnection(connectionId)
  const gmail = google.gmail({ version: 'v1', auth })

  const mime = buildMimeMessage(to, subject, htmlBody, cc, attachments, bcc)
  const raw = encodeMessage(mime)

  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  })

  return {
    messageId: res.data.id!,
    threadId: res.data.threadId!,
  }
}

export async function getThread(connectionId: string, threadId: string) {
  const auth = await getAuthedClientByConnection(connectionId)
  const gmail = google.gmail({ version: 'v1', auth })
  const res = await gmail.users.threads.get({ userId: 'me', id: threadId, format: 'full' })
  return res.data
}

export async function listThreads(connectionId: string, query: string, maxResults = 20) {
  const auth = await getAuthedClientByConnection(connectionId)
  const gmail = google.gmail({ version: 'v1', auth })
  const res = await gmail.users.threads.list({ userId: 'me', q: query, maxResults })
  return res.data.threads ?? []
}

export async function sendReply(
  connectionId: string,
  threadId: string,
  to: string,
  subject: string,
  htmlBody: string,
  inReplyTo: string,
  cc?: string,
  attachments?: EmailAttachment[],
  bcc?: string,
): Promise<{ messageId: string; threadId: string }> {
  const auth = await getAuthedClientByConnection(connectionId)
  const gmail = google.gmail({ version: 'v1', auth })

  const utf8Subject = subject.startsWith('Re:') ? subject : `Re: ${subject}`
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`
  const encodedSubject = `=?utf-8?B?${Buffer.from(utf8Subject).toString('base64')}?=`
  const lines: string[] = []

  lines.push(`To: ${to}`)
  if (cc) lines.push(`Cc: ${cc}`)
  if (bcc) lines.push(`Bcc: ${bcc}`)
  lines.push(`Subject: ${encodedSubject}`)
  lines.push('MIME-Version: 1.0')
  lines.push(`In-Reply-To: ${inReplyTo}`)
  lines.push(`References: ${inReplyTo}`)

  if (attachments?.length) {
    lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`)
    lines.push('')
    lines.push(`--${boundary}`)
    lines.push('Content-Type: text/html; charset=utf-8')
    lines.push('')
    lines.push(htmlBody)
    for (const att of attachments) {
      lines.push(`--${boundary}`)
      lines.push(`Content-Type: ${att.mimeType}`)
      lines.push('Content-Transfer-Encoding: base64')
      lines.push(`Content-Disposition: attachment; filename="${att.filename}"`)
      lines.push('')
      lines.push(att.content.toString('base64'))
    }
    lines.push(`--${boundary}--`)
  } else {
    lines.push('Content-Type: text/html; charset=utf-8')
    lines.push('')
    lines.push(htmlBody)
  }

  const raw = encodeMessage(lines.join('\n'))

  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw, threadId },
  })

  return {
    messageId: res.data.id!,
    threadId: res.data.threadId!,
  }
}

export async function watchGmail(connectionId: string) {
  const auth = await getAuthedClientByConnection(connectionId)
  const gmail = google.gmail({ version: 'v1', auth })

  const res = await gmail.users.watch({
    userId: 'me',
    requestBody: {
      topicName: `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/topics/gmail-notifications`,
      labelIds: ['INBOX'],
    },
  })

  return { historyId: res.data.historyId }
}

export async function modifyThreadLabels(
  connectionId: string,
  threadId: string,
  addLabelIds: string[],
  removeLabelIds: string[]
): Promise<unknown> {
  const auth = await getAuthedClientByConnection(connectionId)
  const gmail = google.gmail({ version: 'v1', auth })
  const res = await gmail.users.threads.modify({
    userId: 'me',
    id: threadId,
    requestBody: {
      addLabelIds,
      removeLabelIds,
    },
  })
  return res.data
}

export async function trashThread(
  connectionId: string,
  threadId: string
): Promise<unknown> {
  const auth = await getAuthedClientByConnection(connectionId)
  const gmail = google.gmail({ version: 'v1', auth })
  const res = await gmail.users.threads.trash({
    userId: 'me',
    id: threadId,
  })
  return res.data
}

export async function untrashThread(
  connectionId: string,
  threadId: string
): Promise<unknown> {
  const auth = await getAuthedClientByConnection(connectionId)
  const gmail = google.gmail({ version: 'v1', auth })
  const res = await gmail.users.threads.untrash({
    userId: 'me',
    id: threadId,
  })
  return res.data
}



