'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import {
  Mail, Send, Reply, RefreshCw, FolderKanban,
  ChevronDown, ChevronUp, ExternalLink, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { RichTextEditor, type RichTextEditorHandle } from './RichTextEditor'
import { ContactSuggestInput, type ContactSuggestion } from './ContactSuggestInput'
import { ContactsPanel } from './ContactsPanel'
import { render } from '@react-email/render'
import OutreachEmail from '@/lib/email/templates/outreach'
import ThankYouEmail from '@/lib/email/templates/thank-you'
import DeclinationEmail from '@/lib/email/templates/declination'

// ── Types ────────────────────────────────────────────────────────────────────

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

// ── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = Date.now()
  const diff = now - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function initials(name: string | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((w) => w[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function avatarColor(name: string | null): string {
  let hash = 0
  const str = name ?? '?'
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return `hsl(${hash % 360}, 55%, 50%)`
}

// ── Component ────────────────────────────────────────────────────────────────

export function EmailInterface({ dealId, dealName }: { dealId: string; dealName: string | null }) {
  // Thread list
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)
  const [includePortfolio, setIncludePortfolio] = useState(false)

  // Selected thread
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [allMessagesExpanded, setAllMessagesExpanded] = useState(false)

  // Compose
  const [composeMode, setComposeMode] = useState<'new' | 'reply' | null>(null)
  const [composeTo, setComposeTo] = useState('')
  const [composeCc, setComposeCc] = useState('')
  const [showCc, setShowCc] = useState(false)
  const [composeSubject, setComposeSubject] = useState('')
  const [composeBody, setComposeBody] = useState('')
  const [composeContactId, setComposeContactId] = useState('')
  const [sending, setSending] = useState(false)
  const [gmailError, setGmailError] = useState('')

  const editorRef = useRef<RichTextEditorHandle>(null)

  // ── Data fetching ────────────────────────────────────────────────────────

  const fetchThreads = useCallback(async (portfolio: boolean) => {
    console.log('[EmailInterface] fetchThreads called, dealId:', dealId)
    setLoading(true)
    setGmailError('')
    try {
      const url = `/api/deals/${dealId}/emails${portfolio ? '?portfolio=true' : ''}`
      console.log('[EmailInterface] fetching:', url)
      const res = await fetch(url)
      if (res.ok) {
        setThreads(await res.json())
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

  // Fetch threads on mount and when portfolio toggle changes.
  // Deferred via requestIdleCallback to avoid sync setState in effect (React 19 rule).
  useEffect(() => {
    const doFetch = () => fetchThreads(includePortfolio)
    if (window.requestIdleCallback) {
      const id = window.requestIdleCallback(doFetch)
      return () => window.cancelIdleCallback(id)
    } else {
      const id = setTimeout(doFetch, 0)
      return () => clearTimeout(id)
    }
  }, [includePortfolio, fetchThreads])

  const openThread = useCallback(async (thread: Thread) => {
    setSelectedThread(thread)
    setMessagesLoading(true)
    setComposeMode(null)
    setAllMessagesExpanded(false)
    setGmailError('')
    try {
      const res = await fetch(`/api/deals/${dealId}/emails/threads?threadId=${thread.threadId}&dealId=${dealId}`)
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

  // ── Compose actions ──────────────────────────────────────────────────────

  const openCompose = useCallback(() => {
    setComposeMode('new')
    setComposeTo('')
    setComposeCc('')
    setShowCc(false)
    setComposeSubject('')
    setComposeBody('')
    setComposeContactId('')
    editorRef.current?.clear()
    setSelectedThread(null)
    setMessages([])
  }, [])

  const startReply = useCallback(() => {
    if (!selectedThread || messages.length === 0) return
    const lastMsg = messages[messages.length - 1]!
    setComposeMode('reply')
    setComposeTo(lastMsg.from)
    setComposeCc('')
    setShowCc(false)
    setComposeSubject(selectedThread.subject ?? '')
    setComposeBody('')
    setComposeContactId('')
    editorRef.current?.clear()
  }, [selectedThread, messages])

  const handleContactEmailClick = useCallback((email: string, contactId: string) => {
    setComposeMode('new')
    setComposeTo(email)
    setComposeCc('')
    setShowCc(false)
    setComposeSubject('')
    setComposeBody('')
    setComposeContactId(contactId)
    editorRef.current?.clear()
    setSelectedThread(null)
    setMessages([])
  }, [])

  const handleContactSelect = useCallback((contact: ContactSuggestion) => {
    setComposeContactId(contact.id)
  }, [])

  const insertTemplate = useCallback(async (template: 'outreach' | 'thank_you' | 'declination') => {
    try {
      let html = ''
      const senderName = 'Team'
      if (template === 'outreach') {
        html = await render(OutreachEmail({ ownerName: 'Owner', propertyAddress: dealName ?? 'the property', senderName }))
      } else if (template === 'thank_you') {
        html = await render(ThankYouEmail({ ownerName: 'Owner', propertyAddress: dealName ?? 'the property', senderName }))
      } else {
        html = await render(DeclinationEmail({ ownerName: 'Owner', propertyAddress: dealName ?? 'the property', senderName }))
      }
      editorRef.current?.insertHTML(html)
    } catch {
      toast.error('Failed to insert template')
    }
  }, [dealName])

  const handleSend = useCallback(async () => {
    if (!composeTo || !composeSubject) return
    const body = editorRef.current ? composeBody : composeBody
    if (!body) return
    setSending(true)
    try {
      const lastMsg = messages.length > 0 ? messages[messages.length - 1]! : null
      const res = await fetch(`/api/deals/${dealId}/emails/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: composeTo,
          subject: composeSubject,
          htmlBody: body,
          contact_id: composeContactId || undefined,
          cc: composeCc || undefined,
          threadId: composeMode === 'reply' && selectedThread ? selectedThread.threadId : undefined,
          inReplyTo: composeMode === 'reply' && lastMsg ? lastMsg.id : undefined,
        }),
      })
      if (res.ok) {
        toast.success('Email sent')
        setComposeMode(null)
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
  }, [composeTo, composeSubject, composeBody, composeCc, composeContactId, composeMode, selectedThread, messages, dealId, fetchThreads, includePortfolio])

  const dismissCompose = useCallback(() => {
    setComposeMode(null)
  }, [])

  // ── Error state ──────────────────────────────────────────────────────────

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

  // ── Render ───────────────────────────────────────────────────────────────

  const visibleMessages = allMessagesExpanded || messages.length <= 3
    ? messages
    : messages.slice(messages.length - 3)

  return (
    <div className="flex h-[calc(100vh-340px)] min-h-[460px] border rounded-xl overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
      {/* ═══ Thread List (left) ══════════════════════════════════════════════ */}
      <div
        className="w-[320px] flex-shrink-0 flex flex-col border-r"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-0)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'var(--color-surface-2)' }}
        >
          <h4 className="text-[13px] font-semibold" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans)' }}>
            Inbox
          </h4>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setIncludePortfolio(!includePortfolio)
                setSelectedThread(null)
                setMessages([])
              }}
              className={`flex items-center gap-1.5 h-6 px-2 rounded text-[10px] font-medium transition-colors ${
                includePortfolio ? '' : ''
              }`}
              style={{
                background: includePortfolio ? 'var(--color-accent-bg)' : 'transparent',
                color: includePortfolio ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
              }}
              title="Include portfolio emails"
            >
              <FolderKanban size={11} />
              Portfolio
            </button>
            <button
              onClick={() => fetchThreads(includePortfolio)}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-[var(--color-surface-2)] transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
              title="Refresh"
            >
              <RefreshCw size={12} />
            </button>
            <button
              onClick={openCompose}
              className="h-7 px-3 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1"
              style={{ background: 'var(--color-accent)', color: 'var(--color-text-inverse)' }}
            >
              <Mail size={11} />
              New
            </button>
          </div>
        </div>

        {/* Contacts panel */}
        <ContactsPanel dealId={dealId} onEmailClick={handleContactEmailClick} />

        {/* Thread items */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="space-y-0.5 p-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-lg px-3 py-3 animate-pulse">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full flex-shrink-0" style={{ background: 'var(--color-surface-2)' }} />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex justify-between">
                        <div className="h-3 w-24 rounded" style={{ background: 'var(--color-surface-2)' }} />
                        <div className="h-3 w-10 rounded" style={{ background: 'var(--color-surface-2)' }} />
                      </div>
                      <div className="h-3 w-20 rounded" style={{ background: 'var(--color-surface-2)' }} />
                      <div className="h-3 w-full rounded" style={{ background: 'var(--color-surface-2)' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : threads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <Mail size={28} style={{ color: 'var(--color-text-tertiary)', opacity: 0.5, marginBottom: 12 }} />
              <p className="text-[13px] font-medium" style={{ color: 'var(--color-text-primary)' }}>No conversations yet</p>
              <p className="text-[11px] mt-1 mb-4" style={{ color: 'var(--color-text-tertiary)' }}>
                Send your first outreach email
              </p>
              <button
                onClick={openCompose}
                className="h-7 px-3 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1"
                style={{ background: 'var(--color-accent)', color: 'var(--color-text-inverse)' }}
              >
                <Send size={11} />
                New Message
              </button>
            </div>
          ) : (
            threads.map((thread) => {
              const isSelected = selectedThread?.threadId === thread.threadId
              return (
                <button
                  key={thread.threadId}
                  onClick={() => openThread(thread)}
                  className={`w-full text-left px-3 py-3 border-b transition-colors hover:bg-[var(--color-surface-1)] ${
                    isSelected ? '' : ''
                  }`}
                  style={{
                    borderColor: 'var(--color-surface-2)',
                    background: isSelected ? 'var(--color-surface-1)' : undefined,
                  }}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div
                      className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold"
                      style={{
                        background: avatarColor(thread.contactName),
                        color: '#fff',
                      }}
                    >
                      {initials(thread.contactName)}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Name + date + status */}
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[13px] font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                            {thread.contactName ?? thread.contactEmail ?? 'Unknown'}
                          </span>
                          {thread.status === 'replied' && (
                            <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--color-success-text)' }} />
                          )}
                          {thread.status === 'gmail' && (
                            <span className="text-[9px] font-medium px-1 rounded flex-shrink-0" style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-tertiary)' }}>Gmail</span>
                          )}
                        </div>
                        <span className="text-[10px] flex-shrink-0 ml-2" style={{ color: 'var(--color-text-tertiary)' }}>
                          {relativeTime(thread.lastDate)}
                        </span>
                      </div>

                      {/* Subject */}
                      <p className="text-[12px] truncate mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                        {thread.subject ?? '(no subject)'}
                      </p>

                      {/* Badges */}
                      <div className="flex items-center gap-1.5">
                        {thread.isPortfolioSibling && (
                          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium"
                            style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-secondary)' }}>
                            <FolderKanban size={9} />
                            {thread.dealName ?? 'Portfolio'}
                          </span>
                        )}
                        <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                          {thread.messageCount} {thread.messageCount === 1 ? 'msg' : 'msgs'}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* ═══ Right Panel (thread view OR compose) ════════════════════════════ */}
      <div className="flex-1 flex flex-col" style={{ background: 'var(--color-canvas)' }}>
        {/* ── Compose mode ────────────────────────────────────────────────── */}
        {composeMode ? (
          <div className="flex flex-col h-full">
            {/* Compose header */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: 'var(--color-surface-2)' }}
            >
              <span className="text-[14px] font-semibold" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans)' }}>
                {composeMode === 'reply' ? 'Reply' : 'New Message'}
              </span>
              <button
                onClick={dismissCompose}
                className="h-6 w-6 flex items-center justify-center rounded hover:bg-[var(--color-surface-2)] transition-colors"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Compose body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* To field with contact suggestions */}
              <ContactSuggestInput
                value={composeTo}
                onChange={setComposeTo}
                onSelect={handleContactSelect}
                dealId={dealId}
                placeholder="To: email@example.com"
                disabled={composeMode === 'reply'}
              />

              {/* CC/BCC toggle */}
              {!showCc ? (
                <button
                  onClick={() => setShowCc(true)}
                  className="text-[11px] font-medium hover:underline"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  Cc / Bcc
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    value={composeCc}
                    onChange={(e) => setComposeCc(e.target.value)}
                    placeholder="Cc: email@example.com"
                    className="h-8 text-[13px] flex-1 bg-[var(--color-surface-0)] border-[var(--color-surface-3)] focus:border-[var(--color-accent)]"
                  />
                  <button
                    onClick={() => { setShowCc(false); setComposeCc('') }}
                    className="h-6 w-6 flex items-center justify-center rounded hover:bg-[var(--color-surface-2)] transition-colors flex-shrink-0"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              {/* Subject */}
              <Input
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                placeholder="Subject"
                className="h-8 text-[13px] bg-[var(--color-surface-0)] border-[var(--color-surface-3)] focus:border-[var(--color-accent)]"
                disabled={composeMode === 'reply'}
              />

              {/* Template pills (new message only) */}
              {composeMode === 'new' && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-medium flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>
                    Templates:
                  </span>
                  {([
                    ['outreach', 'Outreach'],
                    ['thank_you', 'Thank You'],
                    ['declination', 'Declination'],
                  ] as const).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => insertTemplate(key)}
                      className="h-6 px-2 rounded text-[10px] font-medium transition-colors border"
                      style={{
                        color: 'var(--color-text-secondary)',
                        borderColor: 'var(--color-surface-3)',
                        background: 'var(--color-surface-0)',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {/* Rich text editor */}
              <RichTextEditor
                ref={editorRef}
                value={composeBody}
                onChange={setComposeBody}
                placeholder="Write your message..."
                disabled={sending}
                minHeight={200}
              />
            </div>

            {/* Compose footer */}
            <div
              className="flex items-center justify-end gap-2 px-4 py-3 border-t"
              style={{ borderColor: 'var(--color-surface-2)' }}
            >
              <Button
                variant="outline"
                size="sm"
                onClick={dismissCompose}
                disabled={sending}
                className="h-8 text-[12px]"
              >
                Discard
              </Button>
              <Button
                size="sm"
                onClick={handleSend}
                disabled={!composeTo || !composeSubject || sending}
                className="h-8 text-[12px]"
                style={{ background: 'var(--color-accent)', color: 'var(--color-text-inverse)', border: 'none' }}
              >
                <Send size={13} />
                {sending ? 'Sending...' : 'Send'}
              </Button>
            </div>
          </div>
        ) : !selectedThread ? (
          /* ── Empty / placeholder ─────────────────────────────────────── */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3">
              <Mail size={36} style={{ color: 'var(--color-text-tertiary)', opacity: 0.4 }} />
              <p className="text-[13px]" style={{ color: 'var(--color-text-tertiary)' }}>
                Select a conversation to view emails
              </p>
              <button
                onClick={openCompose}
                className="h-7 px-3 rounded-md text-[11px] font-medium transition-colors inline-flex items-center gap-1"
                style={{ background: 'var(--color-accent)', color: 'var(--color-text-inverse)' }}
              >
                <Send size={11} />
                New Message
              </button>
            </div>
          </div>
        ) : messagesLoading ? (
          /* ── Loading messages ────────────────────────────────────────── */
          <div className="flex-1 flex items-center justify-center">
            <LoadingSpinner size="md" />
          </div>
        ) : (
          /* ── Thread view ────────────────────────────────────────────── */
          <div className="flex flex-col h-full">
            {/* Thread header */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: 'var(--color-surface-2)' }}
            >
              <div className="min-w-0">
                <h4 className="text-[14px] font-semibold truncate" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans)' }}>
                  {selectedThread?.subject ?? '(no subject)'}
                </h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                    {selectedThread?.contactName ?? 'Unknown'}
                  </span>
                  {selectedThread?.contactEmail && (
                    <>
                      <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>&middot;</span>
                      <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>{selectedThread.contactEmail}</span>
                    </>
                  )}
                  {selectedThread && (
                    <>
                      <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>&middot;</span>
                      <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                        {selectedThread.messageCount} {selectedThread.messageCount === 1 ? 'message' : 'messages'}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Button size="sm" variant="outline" onClick={startReply} className="h-7 text-[11px] gap-1">
                  <Reply size={12} />
                  Reply
                </Button>
                {selectedThread?.threadId && (
                  <a
                    href={`https://mail.google.com/mail/u/0/#inbox/${selectedThread.threadId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-7 w-7 flex items-center justify-center rounded transition-colors hover:bg-[var(--color-surface-2)]"
                    style={{ color: 'var(--color-text-tertiary)' }}
                    title="Open in Gmail"
                  >
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {!allMessagesExpanded && messages.length > 3 && (
                <button
                  onClick={() => setAllMessagesExpanded(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-medium transition-colors hover:bg-[var(--color-surface-1)]"
                  style={{ color: 'var(--color-accent)' }}
                >
                  <ChevronDown size={14} />
                  Show all {messages.length} messages
                </button>
              )}

              {visibleMessages.map((msg, idx) => (
                <div
                  key={msg.id}
                  className="rounded-lg border p-4"
                  style={{
                    background: 'var(--color-surface-0)',
                    borderColor: 'var(--color-surface-2)',
                    boxShadow: 'var(--shadow-xs)',
                  }}
                >
                  {/* Message header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold"
                        style={{ background: avatarColor(msg.from), color: '#fff' }}
                      >
                        {initials(msg.from)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            {msg.from}
                          </span>
                          {idx === messages.length - 1 && messages.length > 1 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                              style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-secondary)' }}>
                              latest
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                            To: {msg.to}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] flex-shrink-0 ml-3" style={{ color: 'var(--color-text-tertiary)' }}>
                      {msg.date}
                    </span>
                  </div>

                  {/* Message body */}
                  <div
                    className="text-[13px] leading-relaxed max-w-none"
                    style={{
                      color: 'var(--color-text-secondary)',
                      wordBreak: 'break-word',
                    }}
                  >
                    {msg.body ? (
                      <div
                        dangerouslySetInnerHTML={{ __html: msg.body }}
                        className="prose prose-sm max-w-none"
                        style={{
                          // Scope styles to message body so inline styles from emails render properly
                          lineHeight: 1.7,
                        }}
                      />
                    ) : (
                      <p className="italic" style={{ color: 'var(--color-text-tertiary)' }}>{msg.snippet}</p>
                    )}
                  </div>
                </div>
              ))}

              {allMessagesExpanded && messages.length > 3 && (
                <button
                  onClick={() => setAllMessagesExpanded(false)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-medium transition-colors hover:bg-[var(--color-surface-1)]"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  <ChevronUp size={14} />
                  Show less
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
