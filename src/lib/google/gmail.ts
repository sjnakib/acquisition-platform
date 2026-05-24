import { google } from 'googleapis'
import { getAuthedClient } from './oauth'

export async function sendEmail(
  userId: string,
  to: string,
  subject: string,
  htmlBody: string
): Promise<{ messageId: string; threadId: string }> {
  const auth = await getAuthedClient(userId)
  const gmail = google.gmail({ version: 'v1', auth })

  const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`
  const messageParts = [
    `To: ${to}`,
    `Subject: ${utf8Subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    htmlBody,
  ]
  const message = Buffer.from(messageParts.join('\n'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: message },
  })

  return {
    messageId: res.data.id!,
    threadId: res.data.threadId!,
  }
}

export async function getThread(userId: string, threadId: string) {
  const auth = await getAuthedClient(userId)
  const gmail = google.gmail({ version: 'v1', auth })
  const res = await gmail.users.threads.get({ userId: 'me', id: threadId, format: 'full' })
  return res.data
}

export async function listThreads(userId: string, query: string, maxResults = 20) {
  const auth = await getAuthedClient(userId)
  const gmail = google.gmail({ version: 'v1', auth })
  const res = await gmail.users.threads.list({ userId: 'me', q: query, maxResults })
  return res.data.threads ?? []
}

export async function sendReply(
  userId: string,
  threadId: string,
  to: string,
  subject: string,
  htmlBody: string,
  inReplyTo: string
): Promise<{ messageId: string; threadId: string }> {
  const auth = await getAuthedClient(userId)
  const gmail = google.gmail({ version: 'v1', auth })

  const utf8Subject = subject.startsWith('Re:') ? subject : `Re: ${subject}`
  const encodedSubject = `=?utf-8?B?${Buffer.from(utf8Subject).toString('base64')}?=`
  const messageParts = [
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    `In-Reply-To: ${inReplyTo}`,
    `References: ${inReplyTo}`,
    '',
    htmlBody,
  ]
  const message = Buffer.from(messageParts.join('\n'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: message, threadId },
  })

  return {
    messageId: res.data.id!,
    threadId: res.data.threadId!,
  }
}

export async function watchGmail(userId: string) {
  const auth = await getAuthedClient(userId)
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
