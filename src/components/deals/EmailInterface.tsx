'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import {
  Mail, Send, Reply, RefreshCw, FolderKanban,
  User
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'

interface Thread {
  threadId: string
  subject: string | null
  dealName: string | null
  dealId: string
  contactName: string | null
  contactEmail: string | null
  status: string
  lastDate: string | null
  responseClassification: string | null
  messageCount: number
  isPortfolioSibling: boolean
}

interface Message {
  id: string
  threadId: string | null
  snippet: string
  from: string
  to: string
  subject: string
  date: string
  labelIds: string[]
  body: string
}

export function EmailInterface({ dealId, dealName }: { dealId: string; dealName: string | null }) {
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [includePortfolio, setIncludePortfolio] = useState(false)
  const [showCompose, setShowCompose] = useState(false)
  const [showReply, setShowReply] = useState(false)
  const [composeTo, setComposeTo] = useState('')
  const [composeSubject, setComposeSubject] = useState('')
  const [composeBody, setComposeBody] = useState('')
  const [composeContactId, setComposeContactId] = useState('')
  const [sending, setSending] = useState(false)
  const [gmailError, setGmailError] = useState('')

  const fetchThreads = useCallback(async (portfolio: boolean) => {
    setLoading(true)
    setGmailError('')
    try {
      const url = `/api/deals/${dealId}/emails${portfolio ? '?portfolio=true' : ''}`
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setThreads(data)
      } else {
        const json = await res.json()
        if (json.error?.includes('Google account not connected')) {
          setGmailError(json.error)
        } else {
          toast.error(json.error ?? 'Failed to load emails')
        }
      }
    } catch {
      toast.error('Failed to load emails')
    } finally {
      setLoading(false)
    }
  }, [dealId])

  useEffect(() => {
    fetchThreads(includePortfolio)
  }, [includePortfolio, fetchThreads])

  const openThread = useCallback(async (thread: Thread) => {
    setSelectedThread(thread)
    setMessagesLoading(true)
    setShowReply(false)
    setGmailError('')
    try {
      const res = await fetch(`/api/deals/${dealId}/emails/threads?threadId=${thread.threadId}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages ?? [])
      } else {
        const json = await res.json()
        if (json.error?.includes('Google account not connected')) {
          setGmailError(json.error)
          toast.error(json.error)
        }
        setMessages([])
      }
    } catch {
      toast.error('Failed to load thread')
      setMessages([])
    } finally {
      setMessagesLoading(false)
    }
  }, [dealId])

  const handleSend = useCallback(async () => {
    if (!composeTo || !composeSubject || !composeBody) return
    setSending(true)
    try {
      const res = await fetch(`/api/deals/${dealId}/emails/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: composeTo,
          subject: composeSubject,
          htmlBody: composeBody,
          contact_id: composeContactId || undefined,
          threadId: showReply && selectedThread ? selectedThread.threadId : undefined,
          inReplyTo: showReply && messages.length > 0 ? messages[messages.length - 1]!.id : undefined,
        }),
      })
      if (res.ok) {
        toast.success('Email sent')
        setShowCompose(false)
        setShowReply(false)
        setComposeTo('')
        setComposeSubject('')
        setComposeBody('')
        setComposeContactId('')
        fetchThreads(includePortfolio)
      } else {
        const json = await res.json()
        toast.error(json.error ?? 'Failed to send')
      }
    } catch {
      toast.error('Failed to send email')
    } finally {
      setSending(false)
    }
  }, [composeTo, composeSubject, composeBody, composeContactId, dealId, showReply, selectedThread, messages, fetchThreads, includePortfolio])

  const startReply = useCallback(() => {
    if (!selectedThread || messages.length === 0) return
    const lastMsg = messages[messages.length - 1]!
    setComposeTo(lastMsg.from)
    setComposeSubject(selectedThread.subject ?? '')
    setComposeBody('')
    setShowReply(true)
  }, [selectedThread, messages])

  const handlePortfolioToggle = useCallback((checked: boolean) => {
    setIncludePortfolio(checked)
    setSelectedThread(null)
    setMessages([])
  }, [])

  if (gmailError && !loading) {
    return (
      <EmptyState
        icon={Mail}
        title="Gmail Not Connected"
        description={gmailError}
        action={{ label: 'Go to Settings', onClick: () => window.open('/settings', '_blank') }}
      />
    )
  }

  return (
    <div className="flex h-[calc(100vh-340px)] min-h-[420px] border rounded-xl overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
      {/* Thread list panel */}
      <div
        className="w-[340px] flex-shrink-0 flex flex-col border-r"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-0)' }}
      >
        {/* Panel header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'var(--color-surface-2)' }}
        >
          <h4 className="text-[13px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Conversations
          </h4>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handlePortfolioToggle(!includePortfolio)}
              className={`flex items-center gap-1.5 h-6 px-2 rounded text-[10px] font-medium transition-colors ${
                includePortfolio
                  ? 'bg-[var(--color-accent-bg)] text-[var(--color-accent)]'
                  : ''
              }`}
              style={!includePortfolio ? { color: 'var(--color-text-tertiary)' } : {}}
              title="Include portfolio emails"
            >
              <FolderKanban size={11} />
              Portfolio
            </button>
            <button
              onClick={() => { setShowCompose(true); setShowReply(false); fetchThreads(includePortfolio) }}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-[var(--color-surface-2)] transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
              title="Refresh"
            >
              <RefreshCw size={12} />
            </button>
            <button
              onClick={() => { setShowCompose(!showCompose); setShowReply(false) }}
              className="h-7 px-3 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1"
              style={{ background: 'var(--color-accent)', color: 'var(--color-text-inverse)' }}
            >
              <Send size={11} />
              New
            </button>
          </div>
        </div>

        {/* Thread list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10">
              <LoadingSpinner size="md" />
            </div>
          ) : threads.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-[12px]" style={{ color: 'var(--color-text-tertiary)' }}>
                No email conversations found.
              </p>
            </div>
          ) : (
            threads.map((thread) => (
              <button
                key={thread.threadId}
                onClick={() => openThread(thread)}
                className={`w-full text-left px-4 py-3 border-b transition-colors hover:bg-[var(--color-surface-1)] ${
                  selectedThread?.threadId === thread.threadId ? 'bg-[var(--color-surface-1)]' : ''
                }`}
                style={{ borderColor: 'var(--color-surface-2)' }}
              >
                <div className="flex items-start justify-between mb-1">
                  <span className="text-[13px] font-medium truncate max-w-[200px]" style={{ color: 'var(--color-text-primary)' }}>
                    {thread.contactName ?? 'Unknown'}
                  </span>
                  <span className="text-[10px] flex-shrink-0 ml-1" style={{ color: 'var(--color-text-tertiary)' }}>
                    {thread.lastDate ? formatDate(thread.lastDate) : ''}
                  </span>
                </div>
                <p className="text-[12px] truncate mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                  {thread.subject ?? '(no subject)'}
                </p>
                <div className="flex items-center gap-2">
                  {thread.isPortfolioSibling && (
                    <Badge variant="neutral" size="sm">
                      <FolderKanban size={9} />
                      {thread.dealName ?? 'Portfolio'}
                    </Badge>
                  )}
                  {thread.status === 'replied' && (
                    <span className="text-[10px] font-medium" style={{ color: 'var(--color-success-text)' }}>Replied</span>
                  )}
                  {thread.status === 'sent' && (
                    <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>Sent</span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Message view panel */}
      <div className="flex-1 flex flex-col" style={{ background: 'var(--color-canvas)' }}>
        {!selectedThread && !showCompose ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3">
              <Mail size={36} style={{ color: 'var(--color-text-tertiary)', opacity: 0.4 }} />
              <p className="text-[13px]" style={{ color: 'var(--color-text-tertiary)' }}>
                Select a conversation to view emails
              </p>
            </div>
          </div>
        ) : showCompose || showReply ? (
          /* Compose / Reply form */
          <div className="flex flex-col h-full">
            <div
              className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: 'var(--color-surface-2)' }}
            >
              <span className="text-[13px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {showReply ? 'Reply' : 'New Message'}
              </span>
              <button
                onClick={() => { setShowCompose(false); setShowReply(false) }}
                className="text-[11px] hover:underline"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                Cancel
              </button>
            </div>
            <div className="flex-1 p-4 space-y-3 overflow-y-auto">
              <Input
                placeholder="To: broker@example.com"
                value={composeTo}
                onChange={(e) => setComposeTo(e.target.value)}
                className="h-8 text-[13px] bg-[var(--color-surface-0)] border-[var(--color-surface-3)] focus:border-[var(--color-accent)]"
              />
              <Input
                placeholder="Subject"
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                className="h-8 text-[13px] bg-[var(--color-surface-0)] border-[var(--color-surface-3)] focus:border-[var(--color-accent)]"
              />
              <textarea
                placeholder="Write your message..."
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                rows={10}
                className="w-full text-[13px] rounded-md border px-3 py-2 resize-none outline-none focus:ring-1 focus:ring-[var(--accent)]"
                style={{
                  background: 'var(--color-surface-0)',
                  borderColor: 'var(--color-surface-3)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>
            <div
              className="flex items-center justify-end gap-2 px-4 py-3 border-t"
              style={{ borderColor: 'var(--color-surface-2)' }}
            >
              <Button
                size="sm"
                onClick={handleSend}
                disabled={!composeTo || !composeSubject || !composeBody || sending}
                className="bg-[var(--color-accent)] border-none text-[var(--color-text-inverse)] h-8 text-[12px]"
              >
                <Send size={13} />
                {sending ? 'Sending...' : 'Send'}
              </Button>
            </div>
          </div>
        ) : messagesLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <LoadingSpinner size="md" />
          </div>
        ) : (
          /* Message thread */
          <div className="flex flex-col h-full">
            {/* Thread header */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: 'var(--color-surface-2)' }}
            >
              <div className="min-w-0">
                <h4 className="text-[13px] font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                  {selectedThread?.subject ?? '(no subject)'}
                </h4>
                <p className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                  {selectedThread?.contactName} &middot; {selectedThread?.contactEmail}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={startReply}
                className="h-7 text-[11px]"
              >
                <Reply size={12} />
                Reply
              </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className="rounded-lg border p-4"
                  style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-surface-2)' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <User size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                      <span className="text-[12px] font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {msg.from}
                      </span>
                    </div>
                    <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                      {msg.date}
                    </span>
                  </div>
                  <div
                    className="text-[13px] prose prose-sm max-w-none"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {msg.body ? (
                      <div dangerouslySetInnerHTML={{ __html: msg.body }} />
                    ) : (
                      <p className="italic" style={{ color: 'var(--color-text-tertiary)' }}>{msg.snippet}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
