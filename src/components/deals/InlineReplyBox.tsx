'use client'

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from 'react'
import {
  Send,
  Loader2,
  X,
  Paperclip,
  Trash2,
  ChevronDown,
  Reply,
  Forward,
  ArrowUpRight,
  FileText,
  ReplyAll,
} from 'lucide-react'
import { toast } from 'sonner'
import { RichTextEditor, type RichTextEditorHandle } from '@/components/deals/RichTextEditor'
import { RecipientChipsInput } from '@/components/deals/RecipientChipsInput'
import { threadAvatarColor, threadInitials } from '@/components/shared/EmailThreadList'
import type { ComposeSendData, AttachmentFile } from '@/components/shared/EmailComposer'
import type { EmailMessage } from '@/components/shared/EmailMessagePanel'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface InlineReplyBoxHandle {
  expand: (mode: 'reply' | 'reply-all' | 'forward', targetMessage?: EmailMessage) => void
  collapse: () => void
}

interface InlineReplyBoxProps {
  /** Deal ID for sending. */
  dealId: string
  /** The original message we are replying to/forwarding. */
  message: EmailMessage | null
  /** User's connected Google account email. */
  googleEmail: string | null
  /** Default mode: reply, reply-all, forward. */
  mode: 'reply' | 'reply-all' | 'forward'
  /** Whether currently sending. */
  sending?: boolean
  /** Current user's name for the avatar. */
  senderName?: string
  /** Attachments already staged. */
  attachments?: AttachmentFile[]
  /** Called when Send is triggered. */
  onSend: (data: ComposeSendData) => Promise<void>
  /** Called when attachments are added. */
  onAttach?: (files: FileList) => void
  /** Called when an attachment is removed. */
  onRemoveAttachment?: (id: string) => void
  /** Called when user clicks "Pop out" to convert to floating compose. */
  onPopOut?: (mode: 'reply' | 'reply-all' | 'forward', to: string, cc: string, subject: string, body: string) => void
  /** Called when the box collapses/closes. */
  onCollapse?: () => void
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseSenderEmail(from: string): string {
  const match = from.match(/<([^>]+)>/)
  if (match) return match[1] || from
  return from.trim()
}

function parseSenderName(from: string): string {
  const match = from.match(/^"([^"]+)"|^([^<]+)\s*</)
  if (match) return (match[1] || match[2] || '').trim()
  if (from.includes('@')) return from.split('@')[0] || from
  return from
}

function constructReplyHtml(msg: EmailMessage): string {
  const dateStr = msg.date ? new Date(msg.date).toLocaleString() : 'Date unknown'
  const fromEscaped = msg.from.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const bodyHtml = msg.body || msg.snippet || ''
  return `<div><br></div><div><br></div><div class="gmail_quote">On ${dateStr}, ${fromEscaped} wrote:<br><blockquote class="gmail_quote" style="margin: 0px 0px 0px 0.8ex; border-left: 1px solid rgb(204, 204, 204); padding-left: 1ex;">${bodyHtml}</blockquote></div>`
}

function constructForwardHtml(msg: EmailMessage): string {
  const dateStr = msg.date ? new Date(msg.date).toLocaleString() : 'Date unknown'
  const fromEscaped = msg.from.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const toEscaped = msg.to ? msg.to.replace(/</g, '&lt;').replace(/>/g, '&gt;') : ''
  const bodyHtml = msg.body || msg.snippet || ''
  return `<div><br></div><div><br></div><div class="gmail_quote">---------- Forwarded message ---------<br>From: <b>${fromEscaped}</b><br>Date: ${dateStr}<br>Subject: ${msg.subject || ''}<br>To: ${toEscaped}<br><br><blockquote class="gmail_quote" style="margin: 0px 0px 0px 0.8ex; border-left: 1px solid rgb(204, 204, 204); padding-left: 1ex;">${bodyHtml}</blockquote></div>`
}

function getSchedulePresets(): { label: string; date: Date; timeLabel: string }[] {
  const now = new Date()

  const tomMorning = new Date(now)
  tomMorning.setDate(tomMorning.getDate() + 1)
  tomMorning.setHours(8, 0, 0, 0)

  const tomAfternoon = new Date(now)
  tomAfternoon.setDate(tomAfternoon.getDate() + 1)
  tomAfternoon.setHours(13, 0, 0, 0)

  const monday = new Date(now)
  const daysUntilMonday = (1 + 7 - now.getDay()) % 7 || 7
  monday.setDate(monday.getDate() + daysUntilMonday)
  monday.setHours(8, 0, 0, 0)

  const fmtDate = (d: Date) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`
  }

  return [
    { label: 'Tomorrow morning', date: tomMorning, timeLabel: `${fmtDate(tomMorning)} 8:00 AM` },
    { label: 'Tomorrow afternoon', date: tomAfternoon, timeLabel: `${fmtDate(tomAfternoon)} 1:00 PM` },
    { label: 'Monday morning', date: monday, timeLabel: `${fmtDate(monday)} 8:00 AM` },
  ]
}

// ── Component ──────────────────────────────────────────────────────────────────

export const InlineReplyBox = forwardRef<InlineReplyBoxHandle, InlineReplyBoxProps>(
  function InlineReplyBox(
    {
      dealId,
      message,
      googleEmail,
      mode,
      sending: externalSending,
      senderName = 'Me',
      attachments = [],
      onSend,
      onAttach,
      onRemoveAttachment,
      onPopOut,
      onCollapse,
    },
    ref,
  ) {
    const [expanded, setExpanded] = useState(false)
    const [body, setBody] = useState('')
    const [sending, setSending] = useState(false)
    const [showScheduleMenu, setShowScheduleMenu] = useState(false)
    const [showCustomPicker, setShowCustomPicker] = useState(false)
    const [customDate, setCustomDate] = useState('')

    // Track the active message being replied to or forwarded
    const [activeMessage, setActiveMessage] = useState<EmailMessage | null>(message)

    useEffect(() => {
      if (!expanded) {
        setActiveMessage(message)
      }
    }, [message, expanded])

    // Recipient lists
    const [toEmails, setToEmails] = useState<string[]>([])
    const [ccEmails, setCcEmails] = useState<string[]>([])
    const [bccEmails, setBccEmails] = useState<string[]>([])
    const [showCc, setShowCc] = useState(false)
    const [showBcc, setShowBcc] = useState(false)

    // Dynamic mode & subject
    const [modeState, setModeState] = useState<'reply' | 'reply-all' | 'forward'>(mode)
    const [showSubjectInput, setShowSubjectInput] = useState(false)
    const [subjectText, setSubjectText] = useState('')

    // Type toggle menu
    const [showTypeMenu, setShowTypeMenu] = useState(false)

    const editorRef = useRef<RichTextEditorHandle>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    const activeSending = externalSending ?? sending

    // Initialize recipients dynamically when activeMessage or modeState changes
    const initializeRecipients = useCallback(() => {
      const msg = activeMessage
      if (!msg) return

      const cleanSender = parseSenderEmail(msg.from)
      const isFromMe = !!googleEmail && cleanSender.toLowerCase() === googleEmail.toLowerCase()

      // Parse original recipients
      const toList = msg.to ? msg.to.split(',').map((s: string) => parseSenderEmail(s).trim()) : []
      const ccList = msg.cc ? msg.cc.split(',').map((s: string) => parseSenderEmail(s).trim()) : []

      if (modeState === 'reply') {
        if (isFromMe) {
          // Reply to a message sent by me: target original recipients
          setToEmails(toList)
        } else {
          setToEmails([cleanSender])
        }
        setCcEmails([])
        setBccEmails([])
        setShowCc(false)
        setShowBcc(false)
      } else if (modeState === 'reply-all') {
        if (isFromMe) {
          // Reply-all to a message sent by me: original to is To, original cc is Cc (excluding self)
          const added = new Set<string>()
          if (googleEmail) added.add(googleEmail.toLowerCase())

          const nextTo: string[] = []
          for (const email of toList) {
            const lower = email.toLowerCase()
            if (email && !added.has(lower)) {
              added.add(lower)
              nextTo.push(email)
            }
          }

          const nextCc: string[] = []
          for (const email of ccList) {
            const lower = email.toLowerCase()
            if (email && !added.has(lower)) {
              added.add(lower)
              nextCc.push(email)
            }
          }

          setToEmails(nextTo)
          setCcEmails(nextCc)
          setShowCc(nextCc.length > 0)
        } else {
          // Sent from someone else: To is the sender, Cc is everyone else in To and Cc (excluding self)
          setToEmails([cleanSender])

          const added = new Set<string>()
          added.add(cleanSender.toLowerCase())
          if (googleEmail) added.add(googleEmail.toLowerCase())

          const nextCc: string[] = []
          for (const email of [...toList, ...ccList]) {
            const lower = email.toLowerCase()
            if (email && !added.has(lower)) {
              added.add(lower)
              nextCc.push(email)
            }
          }

          setCcEmails(nextCc)
          setShowCc(nextCc.length > 0)
        }
        setBccEmails([])
        setShowBcc(false)
      } else if (modeState === 'forward') {
        setToEmails([])
        setCcEmails([])
        setBccEmails([])
        setShowCc(false)
        setShowBcc(false)
      }
    }, [activeMessage, modeState, googleEmail])

    useEffect(() => {
      initializeRecipients()
    }, [initializeRecipients])

    // Sync subject text
    useEffect(() => {
      const msg = activeMessage
      if (!msg) return
      const isSubjRe = msg.subject?.toLowerCase().startsWith('re:')
      const isSubjFwd = msg.subject?.toLowerCase().startsWith('fwd:')
      
      if (modeState === 'forward') {
        setSubjectText(isSubjFwd ? msg.subject : `Fwd: ${msg.subject}`)
      } else {
        setSubjectText(isSubjRe ? msg.subject : `Re: ${msg.subject}`)
      }
    }, [activeMessage, modeState])

    // Expose imperative API
    useImperativeHandle(ref, () => ({
      expand: (m: 'reply' | 'reply-all' | 'forward', targetMessage?: EmailMessage) => {
        setExpanded(true)
        setModeState(m)
        const msg = targetMessage ?? activeMessage ?? message
        if (targetMessage) {
          setActiveMessage(targetMessage)
        }
        const quoteHtml = msg ? (m === 'forward' ? constructForwardHtml(msg) : constructReplyHtml(msg)) : ''
        setBody(quoteHtml)
        setTimeout(() => {
          containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
          if (editorRef.current) {
            editorRef.current.clear()
            editorRef.current.insertHTML(quoteHtml)
            editorRef.current.focusAtStart()
          }
        }, 60)
      },
      collapse: () => {
        setExpanded(false)
        editorRef.current?.clear()
        setBody('')
        setToEmails([])
        setCcEmails([])
        setBccEmails([])
        setShowCc(false)
        setShowBcc(false)
        setShowSubjectInput(false)
        setActiveMessage(message)
      },
    }))

    const handleExpand = useCallback(() => {
      const msg = activeMessage ?? message
      if (!msg) return
      setExpanded(true)
      const quoteHtml = modeState === 'forward' ? constructForwardHtml(msg) : constructReplyHtml(msg)
      setBody(quoteHtml)
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.clear()
          editorRef.current.insertHTML(quoteHtml)
          editorRef.current.focusAtStart()
        }
      }, 60)
    }, [modeState, activeMessage, message])

    const handleCollapse = useCallback(() => {
      setExpanded(false)
      editorRef.current?.clear()
      setBody('')
      setToEmails([])
      setCcEmails([])
      setBccEmails([])
      setShowCc(false)
      setShowBcc(false)
      setShowSubjectInput(false)
      setActiveMessage(message)
      onCollapse?.()
    }, [onCollapse, message])

    const proceedSend = useCallback(
      async (scheduledAt?: string) => {
        if (toEmails.length === 0) {
          toast.error('Please specify at least one recipient')
          return
        }
        if (!body.trim()) {
          toast.error('Message body is empty')
          return
        }
        setSending(true)
        try {
          await onSend({
            to: toEmails.join(', '),
            cc: ccEmails.join(', '),
            bcc: bccEmails.join(', '),
            subject: subjectText,
            htmlBody: body,
            contactId: null,
            scheduledAt,
          })
          setBody('')
          editorRef.current?.clear()
          setExpanded(false)
        } finally {
          setSending(false)
        }
      },
      [body, toEmails, ccEmails, bccEmails, subjectText, onSend],
    )

    const handleSend = useCallback(() => {
      void proceedSend()
    }, [proceedSend])

    const handleScheduleSend = useCallback(
      (date: Date) => {
        void proceedSend(date.toISOString())
      },
      [proceedSend],
    )

    const handlePopOutClick = useCallback(() => {
      if (onPopOut) {
        onPopOut(modeState, toEmails.join(', '), ccEmails.join(', '), subjectText, body)
      }
    }, [onPopOut, modeState, toEmails, ccEmails, subjectText, body])

    // ── Collapsed state ────────────────────────────────────────────────────────

    if (!expanded) {
      return (
        <div
          ref={containerRef}
          role="button"
          tabIndex={0}
          onClick={handleExpand}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleExpand()
            }
          }}
          className="flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all group outline-none"
          style={{
            borderColor: 'var(--color-surface-2)',
            background: 'var(--color-surface-0)',
            boxShadow: 'var(--shadow-xs)',
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-sm)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-xs)'
          }}
        >
          {/* Sender avatar */}
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold"
            style={{
              background: threadAvatarColor(senderName),
              color: 'var(--color-text-inverse)',
            }}
          >
            {threadInitials(senderName)}
          </div>

          <span
            className="text-[13px] flex-1 text-left"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            {modeState === 'reply'
              ? `Reply to ${toEmails.join(', ') || (message ? parseSenderName(message.from) : '')}…`
              : modeState === 'reply-all'
              ? `Reply all…`
              : `Forward…`}
          </span>

          {/* Quick action icons */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <div
              className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-2)]"
              style={{ color: 'var(--color-text-secondary)' }}
              title="Reply"
            >
              <Reply size={14} />
            </div>
            <div
              className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-2)]"
              style={{ color: 'var(--color-text-secondary)' }}
              title="Reply All"
            >
              <ReplyAll size={14} />
            </div>
            <div
              className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-2)]"
              style={{ color: 'var(--color-text-secondary)' }}
              title="Forward"
            >
              <Forward size={14} />
            </div>
          </div>
        </div>
      )
    }

    // ── Expanded state ─────────────────────────────────────────────────────────

    return (
      <div
        ref={containerRef}
        className="rounded-xl border flex flex-col"
        style={{
          borderColor: 'var(--color-surface-2)',
          background: 'var(--color-surface-0)',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        {/* ── Dynamic header options ────────────────────────────────────────── */}
        <div
          className="flex flex-col border-b"
          style={{ borderColor: 'var(--color-surface-2)' }}
        >
          {/* Top row: Type dropdown + Edit subject + Pop out + Discard */}
          <div className="flex items-center justify-between px-3 py-1 border-b" style={{ borderColor: 'var(--color-surface-1)' }}>
            <div className="flex items-center gap-1">
              {/* Type Switcher Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowTypeMenu(!showTypeMenu)}
                  className="h-8 px-2 flex items-center gap-1 rounded-lg hover:bg-[var(--color-surface-2)] transition-colors text-[13px] font-medium"
                  style={{ color: 'var(--color-text-secondary)' }}
                  title="Change response type"
                >
                  {modeState === 'reply' ? (
                    <Reply size={15} />
                  ) : modeState === 'reply-all' ? (
                    <ReplyAll size={15} />
                  ) : (
                    <Forward size={15} />
                  )}
                  <ChevronDown size={12} />
                </button>

                {showTypeMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowTypeMenu(false)}
                    />
                    <div
                      className="absolute left-0 top-full mt-1 w-48 rounded-xl border shadow-lg z-50 py-1"
                      style={{
                        background: 'var(--color-surface-0)',
                        borderColor: 'var(--color-surface-2)',
                        boxShadow: 'var(--shadow-lg)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setModeState('reply')
                          setShowTypeMenu(false)
                        }}
                        className="w-full text-left px-4 py-2 text-[13px] flex items-center gap-2.5 hover:bg-[var(--color-surface-1)]"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        <Reply size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                        Reply
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setModeState('reply-all')
                          setShowTypeMenu(false)
                        }}
                        className="w-full text-left px-4 py-2 text-[13px] flex items-center gap-2.5 hover:bg-[var(--color-surface-1)]"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        <ReplyAll size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                        Reply All
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setModeState('forward')
                          setShowTypeMenu(false)
                        }}
                        className="w-full text-left px-4 py-2 text-[13px] flex items-center gap-2.5 hover:bg-[var(--color-surface-1)]"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        <Forward size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                        Forward
                      </button>
                      <div className="border-t my-1" style={{ borderColor: 'var(--color-surface-2)' }} />
                      <button
                        type="button"
                        onClick={() => {
                          setShowSubjectInput(!showSubjectInput)
                          setShowTypeMenu(false)
                        }}
                        className="w-full text-left px-4 py-2 text-[13px] flex items-center gap-2.5 hover:bg-[var(--color-surface-1)]"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        <ChevronDown size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                        {showSubjectInput ? 'Hide subject' : 'Edit subject'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-0.5">
              {onPopOut && (
                <button
                  type="button"
                  onClick={handlePopOutClick}
                  className="h-7 w-7 flex items-center justify-center rounded-full transition-colors hover:bg-[var(--color-surface-2)]"
                  style={{ color: 'var(--color-text-tertiary)' }}
                  title="Pop out reply"
                >
                  <ArrowUpRight size={13} />
                </button>
              )}
              <button
                type="button"
                onClick={handleCollapse}
                className="h-7 w-7 flex items-center justify-center rounded-full transition-colors hover:bg-[var(--color-surface-2)]"
                style={{ color: 'var(--color-text-tertiary)' }}
                title="Discard"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Recipients Row */}
          <div className="flex flex-col gap-1 p-2 bg-[var(--color-surface-0)]">
            <RecipientChipsInput
              label="To"
              emails={toEmails}
              onChange={setToEmails}
              dealId={dealId}
              placeholder={modeState === 'forward' ? 'Select recipient...' : ''}
              showCcLink={!showCc}
              showBccLink={!showBcc}
              onCcClick={() => setShowCc(true)}
              onBccClick={() => setShowBcc(true)}
            />
            {showCc && (
              <RecipientChipsInput
                label="Cc"
                emails={ccEmails}
                onChange={setCcEmails}
                dealId={dealId}
              />
            )}
            {showBcc && (
              <RecipientChipsInput
                label="Bcc"
                emails={bccEmails}
                onChange={setBccEmails}
                dealId={dealId}
              />
            )}
          </div>

          {/* Subject Row (editable!) */}
          {showSubjectInput && (
            <div className="flex items-center gap-2 px-4 py-2 border-t" style={{ borderColor: 'var(--color-surface-1)' }}>
              <span className="text-[12px] font-medium" style={{ color: 'var(--color-text-tertiary)' }}>Subject:</span>
              <input
                type="text"
                value={subjectText}
                onChange={(e) => setSubjectText(e.target.value)}
                className="flex-1 text-[13px] bg-transparent outline-none border-none py-0.5"
                style={{ color: 'var(--color-text-primary)' }}
              />
            </div>
          )}
        </div>

        {/* ── Body ─────────────────────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 px-1 pt-1">
          <RichTextEditor
            ref={editorRef}
            value={body}
            onChange={setBody}
            placeholder="Write your reply…"
            minHeight={120}
            showAttach={!!onAttach}
            onAttach={onAttach}
            borderless
          />
        </div>

        {/* ── Attachment chips ──────────────────────────────────────────────── */}
        {attachments.length > 0 && (
          <div
            className="px-4 pb-2 flex flex-wrap gap-1.5"
          >
            {attachments.map((att) => (
              <div
                key={att.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px]"
                style={{
                  background: 'var(--color-surface-1)',
                  borderColor: 'var(--color-surface-3)',
                  color: 'var(--color-text-primary)',
                }}
              >
                <FileText size={11} style={{ color: 'var(--color-text-secondary)' }} />
                <span className="truncate max-w-[140px]">{att.filename}</span>
                <span
                  style={{
                    color: 'var(--color-text-tertiary)',
                    fontSize: 10,
                    fontFamily: 'var(--font-jetbrains-mono)',
                  }}
                >
                  ({(att.size_bytes / 1024).toFixed(0)} KB)
                </span>
                {onRemoveAttachment && (
                  <button
                    type="button"
                    onClick={() => onRemoveAttachment(att.id)}
                    className="ml-0.5 hover:text-[var(--color-danger-text)] transition-colors"
                    style={{
                      color: 'var(--color-text-tertiary)',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                    }}
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Bottom toolbar ────────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-4 py-2.5 border-t flex-shrink-0"
          style={{ borderColor: 'var(--color-surface-2)' }}
        >
          {/* Left: Send + Attach */}
          <div className="flex items-center gap-2">
            {/* Send / Schedule send */}
            <div className="relative flex items-center">
              <button
                onClick={handleSend}
                disabled={activeSending}
                className="inline-flex items-center gap-1.5 h-8 px-4 text-[13px] font-medium rounded-l-full transition-colors disabled:opacity-60"
                style={{
                  background: 'var(--color-accent)',
                  color: 'var(--color-text-inverse)',
                  borderRight: '1px solid rgba(255,255,255,0.18)',
                }}
              >
                {activeSending ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Send size={13} />
                )}
                {activeSending ? 'Sending…' : 'Send'}
              </button>
              <button
                onClick={() => setShowScheduleMenu(!showScheduleMenu)}
                disabled={activeSending}
                className="inline-flex items-center justify-center h-8 w-8 rounded-r-full transition-colors disabled:opacity-60"
                style={{
                  background: 'var(--color-accent)',
                  color: 'var(--color-text-inverse)',
                }}
                title="Schedule send"
              >
                <ChevronDown size={13} />
              </button>

              {/* Schedule menu */}
              {showScheduleMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowScheduleMenu(false)}
                  />
                  <div
                    className="absolute bottom-full left-0 mb-2 w-64 rounded-xl border shadow-lg z-50 p-2"
                    style={{
                      background: 'var(--color-surface-0)',
                      borderColor: 'var(--color-surface-2)',
                      boxShadow: 'var(--shadow-lg)',
                    }}
                  >
                    <div
                      className="text-[11px] font-semibold px-2 py-1 mb-1 uppercase tracking-wide"
                      style={{ color: 'var(--color-text-tertiary)' }}
                    >
                      Schedule Send
                    </div>
                    {getSchedulePresets().map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setShowScheduleMenu(false)
                          handleScheduleSend(preset.date)
                        }}
                        className="w-full text-left px-2 py-1.5 text-[12px] hover:bg-[var(--color-surface-1)] rounded-lg transition-colors flex justify-between items-center"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        <span>{preset.label}</span>
                        <span
                          className="text-[10px]"
                          style={{
                            color: 'var(--color-text-tertiary)',
                            fontFamily: 'var(--font-jetbrains-mono)',
                          }}
                        >
                          {preset.timeLabel}
                        </span>
                      </button>
                    ))}
                    <div
                      className="border-t my-1"
                      style={{ borderColor: 'var(--color-surface-2)' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCustomPicker(true)}
                      className="w-full text-left px-2 py-1.5 text-[12px] hover:bg-[var(--color-surface-1)] rounded-lg transition-colors"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Pick date &amp; time…
                    </button>
                  </div>
                </>
              )}

              {/* Custom picker modal */}
              {showCustomPicker && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                  <div
                    className="w-80 rounded-xl border p-4 shadow-xl flex flex-col gap-3"
                    style={{
                      background: 'var(--color-surface-0)',
                      borderColor: 'var(--color-surface-2)',
                    }}
                  >
                    <h4
                      className="text-[13px] font-semibold"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Schedule send
                    </h4>
                    <input
                      type="datetime-local"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="w-full px-3 py-2 text-[13px] rounded-lg border outline-none"
                      style={{
                        borderColor: 'var(--color-surface-2)',
                        background: 'var(--color-surface-1)',
                        color: 'var(--color-text-primary)',
                        fontFamily: 'var(--font-jetbrains-mono)',
                      }}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowCustomPicker(false)}
                        className="h-8 px-3 rounded-lg border text-[13px] transition-colors hover:bg-[var(--color-surface-1)]"
                        style={{
                          borderColor: 'var(--color-surface-3)',
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (customDate) {
                            setShowCustomPicker(false)
                            setShowScheduleMenu(false)
                            handleScheduleSend(new Date(customDate))
                          }
                        }}
                        disabled={!customDate}
                        className="h-8 px-3 rounded-lg text-[13px] font-medium transition-colors disabled:opacity-50"
                        style={{
                          background: 'var(--color-accent)',
                          color: 'var(--color-text-inverse)',
                        }}
                      >
                        Schedule
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Attach */}
            {onAttach && (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-8 w-8 flex items-center justify-center rounded-full transition-colors hover:bg-[var(--color-surface-2)]"
                  style={{ color: 'var(--color-text-secondary)' }}
                  title="Attach file"
                >
                  <Paperclip size={15} />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) {
                      onAttach(e.target.files)
                      e.target.value = ''
                    }
                  }}
                />
              </>
            )}
          </div>

          {/* Right: Discard */}
          <button
            type="button"
            onClick={handleCollapse}
            className="h-8 w-8 flex items-center justify-center rounded-full transition-colors hover:bg-[var(--color-surface-2)]"
            style={{ color: 'var(--color-text-secondary)' }}
            title="Discard"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    )
  },
)
