'use client'

import { useState, useRef, useEffect, type ReactNode, memo } from 'react'
import {
  ChevronDown, ChevronUp, Paperclip, MoreVertical, ExternalLink,
  ChevronRight, AlertTriangle, Check, X, Clock,
} from 'lucide-react'
import { formatEmailFullDate } from '@/lib/utils'
import type { EmailThread } from '@/components/shared/EmailThreadList'

// ── Types ────────────────────────────────────────────────────────────────────

export interface EmailMessage {
  id: string
  threadId: string | null
  messageId?: string
  snippet: string
  from: string
  to: string
  cc?: string
  bcc?: string
  subject: string
  date: string
  labelIds: string[]
  body: string
  attachments?: {
    attachmentId: string
    filename: string
    mimeType: string
    size: number
  }[]
}

export interface EmailMessagePanelProps {
  /** The thread whose messages are being displayed. */
  thread: EmailThread
  /** Messages for the selected thread. */
  messages: EmailMessage[]
  /** Whether messages are currently loading. */
  loading?: boolean
  /** Set of expanded message IDs. */
  expandedMessages: Set<string>
  /** Toggle expand/collapse for a message. */
  onToggleMessage: (msgId: string) => void
  /** Expand all messages. */
  onExpandAll: () => void
  /** Collapse all messages. */
  onCollapseAll: () => void
  /** Called when a message's ⋮ menu action is selected. Return the menu items. */
  renderMessageMenu?: (message: EmailMessage, closeMenu: () => void) => ReactNode
  /** Active menu message ID (for tracking which menu is open). */
  activeMenuMsgId?: string | null
  /** Called to set the active menu message ID. */
  onSetActiveMenuMsgId?: (msgId: string | null) => void
  /** Render custom actions in the thread toolbar bar (left side). */
  renderThreadActions?: () => ReactNode
  /** Render custom content below the thread subject line. */
  renderThreadMeta?: () => ReactNode
  /** Deal ID for attachment download URLs. */
  attachmentDealId: string
  /** Render per-message action buttons (Reply, Reply All, Forward) below expanded body. */
  renderMessageActions?: (message: EmailMessage) => ReactNode
  /** Whether to show the message-level ⋮ action menu. */
  showMessageMenu?: boolean
  /** Optional Gmail thread link override (campaign uses original thread's deal). */
  gmailThreadId?: string
  /**
   * Render the inline reply/forward box below the messages list.
   * Receives the last message for context.
   */
  renderInlineReply?: (lastMessage: EmailMessage | null) => ReactNode
  onConfirmReply?: (thread: EmailThread) => void
  onDismissReply?: (thread: EmailThread) => void
  onSnoozeReply?: (thread: EmailThread) => void
  reviewLoading?: boolean
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function isOwnMessage(from: string): boolean {
  const own = from.toLowerCase()
  return own.includes('acquire') || own.includes('noreply') || own.includes('no-reply')
}

function parseSenderName(from: string): string {
  const match = from.match(/^"([^"]+)"|^([^<]+)\s*</)
  if (match) return (match[1] || match[2] || '').trim()
  if (from.includes('@')) return from.split('@')[0] || from
  return from
}

function parseSenderEmail(from: string): string {
  const match = from.match(/<([^>]+)>/)
  if (match) return match[1] || from
  return from
}

function renderAttachmentName(filename: string): React.ReactNode {
  const idx = filename.lastIndexOf('.')
  if (idx === -1) return <span className="truncate max-w-[120px]">{filename}</span>
  const name = filename.slice(0, idx)
  const ext = filename.slice(idx)
  return (
    <span className="inline-flex min-w-0 max-w-[180px]">
      <span className="truncate flex-shrink min-w-[20px]">{name}</span>
      <span className="flex-shrink-0">{ext}</span>
    </span>
  )
}

// ── ExpandedHeader sub-component (the "to me ▾" togglable metadata) ──────────

function MessageHeaderMeta({ msg }: { msg: EmailMessage }) {
  const [showDetails, setShowDetails] = useState(false)

  return (
    <div className="mt-0.5">
      <button
        onClick={(e) => { e.stopPropagation(); setShowDetails(!showDetails) }}
        className="inline-flex items-center gap-0.5 text-[12px] transition-colors hover:text-[var(--color-text-secondary)]"
        style={{ color: 'var(--color-text-tertiary)' }}
      >
        to me
        <ChevronRight
          size={12}
          className="transition-transform"
          style={{ transform: showDetails ? 'rotate(90deg)' : 'rotate(0deg)' }}
        />
      </button>

      {showDetails && (
        <div
          className="mt-2 text-[12px] space-y-0.5 rounded-lg p-2"
          style={{
            color: 'var(--color-text-secondary)',
            background: 'var(--color-surface-1)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div>
            <span className="font-medium" style={{ color: 'var(--color-text-tertiary)' }}>From: </span>
            {msg.from}
          </div>
          <div>
            <span className="font-medium" style={{ color: 'var(--color-text-tertiary)' }}>To: </span>
            {msg.to}
          </div>
          <div>
            <span className="font-medium" style={{ color: 'var(--color-text-tertiary)' }}>Date: </span>
            {formatEmailFullDate(msg.date)}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Safe HTML Viewer (Sandboxed iframe to prevent global style leakage) ────────

function SafeHtmlViewer({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState('120px')

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    let resizeObserver: ResizeObserver | null = null

    const getCssVariable = (name: string, fallback: string) => {
      if (typeof window === 'undefined') return fallback
      return window.getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
    }

    const updateHeight = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document
        if (!doc) return
        const body = doc.body
        const htmlEl = doc.documentElement
        if (!body || !htmlEl) return

        const measuredHeight = Math.max(
          body.scrollHeight,
          body.offsetHeight,
          htmlEl.clientHeight,
          htmlEl.scrollHeight,
          htmlEl.offsetHeight
        )
        if (measuredHeight > 0) {
          setHeight(`${measuredHeight}px`)
        }
      } catch {
        // Suppress cross-origin/iframe detached issues
      }
    }

    const updateThemeStyles = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document
        const styleEl = doc?.getElementById('theme-styles')
        if (styleEl) {
          const isDark = document.documentElement.classList.contains('dark')
          const textPrimary = getCssVariable('--color-text-primary', isDark ? '#f3f4f6' : '#111827')
          const textSecondary = getCssVariable('--color-text-secondary', isDark ? '#9ca3af' : '#4b5563')
          const textTertiary = getCssVariable('--color-text-tertiary', isDark ? '#6b7280' : '#9ca3af')
          const surface1 = getCssVariable('--color-surface-1', isDark ? '#1f2937' : '#f3f4f6')
          const surface2 = getCssVariable('--color-surface-2', isDark ? '#374151' : '#e5e7eb')
          const surface3 = getCssVariable('--color-surface-3', isDark ? '#4b5563' : '#d1d5db')
          const accent = getCssVariable('--color-accent', '#3b82f6')

          styleEl.textContent = `
            body {
              color: ${textSecondary};
            }
            h1, h2, h3, h4, h5, h6 {
              color: ${textPrimary};
            }
            blockquote {
              border-left-color: ${surface3};
              color: ${textTertiary};
            }
            pre, code {
              background: ${surface1};
            }
            th, td {
              border-color: ${surface2};
            }
            th {
              background: ${surface1};
            }
            a {
              color: ${accent};
            }
          `
        }
      } catch {
        // Suppress
      }
    }

    const handleLoad = () => {
      updateHeight()
      updateThemeStyles()

      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document
        if (doc?.body && typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver(() => {
            updateHeight()
          })
          resizeObserver.observe(doc.body)
        }
      } catch {
        // Suppress
      }
    }

    iframe.addEventListener('load', handleLoad)
    const fallbackTimer = setTimeout(updateHeight, 300)
    window.addEventListener('resize', updateHeight)

    // Mutation observer for theme updates on <html> element
    const themeObserver = new MutationObserver(() => {
      updateThemeStyles()
      updateHeight()
    })
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    return () => {
      iframe.removeEventListener('load', handleLoad)
      window.removeEventListener('resize', updateHeight)
      clearTimeout(fallbackTimer)
      themeObserver.disconnect()
      if (resizeObserver) {
        resizeObserver.disconnect()
      }
    }
  }, [html])

  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  const initialTextSecondary = isDark ? '#9ca3af' : '#4b5563'
  const isHtml = /<[a-z][\s\S]*>/i.test(html)
  const bodyContent = isHtml ? html : `<div style="white-space: pre-wrap; word-break: break-word;">${html}</div>`

  return (
    <iframe
      ref={iframeRef}
      srcDoc={`
        <!DOCTYPE html>
        <html>
          <head>
            <base target="_blank">
            <style id="base-styles">
              body {
                margin: 0;
                padding: 0;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                font-size: 13px;
                line-height: 1.6;
              }
              p {
                margin-top: 0;
                margin-bottom: 1em;
              }
              h1, h2, h3, h4, h5, h6 {
                font-weight: 600;
                line-height: 1.25;
                margin-top: 1.5em;
                margin-bottom: 0.5em;
              }
              h1 { font-size: 1.8em; }
              h2 { font-size: 1.4em; }
              h3 { font-size: 1.2em; }
              h4 { font-size: 1.1em; }
              a {
                text-decoration: underline;
              }
              a:hover {
                opacity: 0.8;
              }
              ul, ol {
                margin-top: 0;
                margin-bottom: 1em;
                padding-left: 2em;
              }
              ul {
                list-style-type: disc;
              }
              ol {
                list-style-type: decimal;
              }
              li {
                margin-bottom: 0.25em;
              }
              blockquote {
                margin: 1em 0;
                padding-left: 1em;
                border-left: 3px solid;
              }
              pre, code {
                font-family: monospace;
                font-size: 0.9em;
                padding: 2px 4px;
                border-radius: 4px;
              }
              pre {
                padding: 12px;
                overflow-x: auto;
                margin-bottom: 1em;
              }
              pre code {
                padding: 0;
                background: transparent;
              }
              table {
                border-collapse: collapse;
                width: 100%;
                margin-bottom: 1em;
              }
              th, td {
                border: 1px solid;
                padding: 8px 12px;
                text-align: left;
              }
              th {
                font-weight: 600;
              }
              img {
                max-width: 100%;
                height: auto;
              }
            </style>
            <style id="theme-styles">
              body { color: ${initialTextSecondary}; }
            </style>
          </head>
          <body>${bodyContent}</body>
        </html>
      `}
      title="Email Message Content"
      sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
      style={{
        width: '100%',
        height: height,
        border: 'none',
        overflow: 'hidden',
        display: 'block',
      }}
    />
  )
}

// ── Memoized Message Item ────────────────────────────────────────────────────

interface MessageItemProps {
  msg: EmailMessage
  isExpanded: boolean
  isLast: boolean
  activeMenuMsgId: string | null | undefined
  attachmentDealId: string
  showMessageMenu: boolean
  onToggle: (msgId: string) => void
  onSetActiveMenuMsgId: (msgId: string | null) => void
  renderMessageMenu?: (message: EmailMessage, closeMenu: () => void) => ReactNode
  renderMessageActions?: (message: EmailMessage) => ReactNode
  renderInlineReply?: (lastMessage: EmailMessage | null) => ReactNode
  lastMessage: EmailMessage | null
}

const MessageItem = memo(function MessageItem({
  msg,
  isExpanded,
  isLast,
  activeMenuMsgId,
  attachmentDealId,
  showMessageMenu,
  onToggle,
  onSetActiveMenuMsgId,
  renderMessageMenu,
  renderMessageActions,
  renderInlineReply,
  lastMessage,
}: MessageItemProps) {
  const own = isOwnMessage(msg.from)
  const senderName = own ? 'Me' : parseSenderName(msg.from)
  const senderEmail = parseSenderEmail(msg.from)

  return (
    <div
      className="border-b"
      style={{ borderColor: 'var(--color-surface-2)' }}
    >
      {/* ── Message header: always visible ────────────────────── */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onToggle(msg.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggle(msg.id)
          }
        }}
        className="flex items-start gap-3 px-6 py-3 cursor-pointer hover:bg-[var(--color-surface-1)] transition-colors group/msg"
      >
        {/* Avatar */}
        <div
          className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold mt-0.5"
          style={{
            background: own ? 'var(--color-accent)' : avatarColor(senderName),
            color: 'var(--color-text-inverse)',
          }}
        >
          {initials(own ? 'Me' : senderName)}
        </div>

        {/* Sender info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[14px] font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
              {senderName}
              {!own && senderEmail && senderEmail !== senderName && (
                <span className="ml-1.5 text-[12px] font-normal" style={{ color: 'var(--color-text-tertiary)' }}>
                  &lt;{senderEmail}&gt;
                </span>
              )}
            </span>

            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Timestamp */}
              <span
                className="text-[12px]"
                style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-jetbrains-mono)' }}
              >
                {formatEmailFullDate(msg.date)}
              </span>

              {/* ⋮ More options — always visible, fully isolated from expand toggle */}
              {showMessageMenu && renderMessageMenu && (
                <div
                  className="relative"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onSetActiveMenuMsgId(activeMenuMsgId === msg.id ? null : msg.id)
                    }}
                    className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-2)] transition-colors"
                    style={{ color: 'var(--color-text-tertiary)' }}
                    title="More options"
                  >
                    <MoreVertical size={15} />
                  </button>
                  {activeMenuMsgId === msg.id && renderMessageMenu(msg, () => onSetActiveMenuMsgId?.(null))}
                </div>
              )}

              {/* Expand/collapse chevron */}
              {isExpanded
                ? <ChevronUp size={15} style={{ color: 'var(--color-text-tertiary)' }} />
                : <ChevronDown size={15} style={{ color: 'var(--color-text-tertiary)' }} />
              }
            </div>
          </div>

          {/* Collapsed: show snippet; Expanded: show "to me ▾" */}
          {isExpanded ? (
            <MessageHeaderMeta msg={msg} />
          ) : (
            <p
              className="text-[12px] truncate mt-0.5"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              {msg.snippet}
            </p>
          )}
        </div>
      </div>

      {/* ── Message body: shown when expanded ─────────────────── */}
      {isExpanded && (
        <div className="px-6 pb-6" style={{ paddingLeft: '4.75rem' /* 24px + 40px avatar + 12px gap */ }}>
          {/* Email body */}
          <div className="text-[14px] leading-relaxed email-content">
            <SafeHtmlViewer html={msg.body || `<p style="color:var(--color-text-tertiary)">(No content)</p>`} />
          </div>

          {/* Attachments */}
          {msg.attachments && msg.attachments.length > 0 && (
            <div
              className="mt-5 pt-4 border-t flex flex-wrap gap-2"
              style={{ borderColor: 'var(--color-surface-2)' }}
            >
              {msg.attachments.map((att) => (
                <a
                  key={att.attachmentId}
                  href={`/api/deals/${attachmentDealId}/emails/attachments?messageId=${msg.id}&attachmentId=${att.attachmentId}&filename=${encodeURIComponent(att.filename)}`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[12px] font-medium transition-colors hover:bg-[var(--color-surface-1)]"
                  style={{ borderColor: 'var(--color-surface-2)', color: 'var(--color-text-secondary)' }}
                >
                  <Paperclip size={11} />
                  {renderAttachmentName(att.filename)}
                </a>
              ))}
            </div>
          )}

          {/* Per-message action buttons: Reply | Reply All | Forward */}
          {renderMessageActions && (
            <div className="flex items-center gap-2 mt-5">
              {renderMessageActions(msg)}
            </div>
          )}
        </div>
      )}

      {/* ── Inline reply box (below last message only) ─────────── */}
      {isLast && renderInlineReply && (
        <div className="px-6 pb-6 pt-2" style={{ paddingLeft: '4.75rem' }}>
          {renderInlineReply(lastMessage)}
        </div>
      )}
    </div>
  )
}, (prev, next) => {
  // Only re-render if these specific props changed for this message
  return prev.msg.id === next.msg.id &&
    prev.isExpanded === next.isExpanded &&
    prev.isLast === next.isLast &&
    prev.activeMenuMsgId === next.activeMenuMsgId &&
    // If menu was open for this msg or is now open for this msg, re-render
    (prev.activeMenuMsgId === prev.msg.id) === (next.activeMenuMsgId === next.msg.id)
})

// ── Skeleton Loader Component ────────────────────────────────────────────────

function MessageSkeleton() {
  return (
    <div className="border-b animate-pulse" style={{ borderColor: 'var(--color-surface-2)' }}>
      <div className="flex items-start gap-3 px-6 py-4">
        {/* Avatar placeholder */}
        <div className="h-10 w-10 rounded-full flex-shrink-0" style={{ background: 'var(--color-surface-2)' }} />
        {/* Content placeholder */}
        <div className="flex-1 min-w-0 space-y-2.5 mt-1">
          <div className="flex items-center justify-between">
            <div className="h-4 w-32 rounded" style={{ background: 'var(--color-surface-2)' }} />
            <div className="h-3.5 w-16 rounded" style={{ background: 'var(--color-surface-2)' }} />
          </div>
          <div className="h-3 w-3/4 rounded" style={{ background: 'var(--color-surface-2)' }} />
        </div>
      </div>
    </div>
  )
}

// ── Component ────────────────────────────────────────────────────────────────

export function EmailMessagePanel({
  thread,
  messages,
  loading,
  expandedMessages,
  onToggleMessage,
  onExpandAll,
  onCollapseAll,
  renderMessageMenu,
  activeMenuMsgId,
  onSetActiveMenuMsgId,
  renderThreadActions,
  renderThreadMeta,
  attachmentDealId,
  renderMessageActions,
  showMessageMenu = true,
  gmailThreadId,
  renderInlineReply,
  onConfirmReply,
  onDismissReply,
  onSnoozeReply,
  reviewLoading,
}: EmailMessagePanelProps) {
  const expandedCount = expandedMessages.size
  const allExpanded = messages.length > 0 && expandedCount === messages.length
  const threadId = gmailThreadId ?? thread.threadId
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] ?? null : null

  const scrollRef = useRef<HTMLDivElement>(null)
  const prevThreadIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (prevThreadIdRef.current !== null && prevThreadIdRef.current !== threadId) {
      scrollRef.current?.scrollTo({ top: 0 })
    }
    prevThreadIdRef.current = threadId
  }, [threadId])

  return (
    <div className="flex flex-col h-full">
      {/* ── Thread toolbar ─────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-3 h-[48px] border-b flex-shrink-0"
        style={{ borderColor: 'var(--color-surface-2)' }}
      >
        {/* Left: thread-level actions (Archive, Reply, etc.) */}
        <div className="flex items-center gap-0.5">
          {renderThreadActions?.()}
        </div>

        {/* Right: expand/collapse + Gmail link */}
        <div className="flex items-center gap-0.5">
          {expandedCount > 0 && (
            <button
              onClick={onCollapseAll}
              className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-2)] transition-colors"
              style={{ color: 'var(--color-text-tertiary)' }}
              title="Collapse all"
            >
              <ChevronUp size={15} />
            </button>
          )}
          {!allExpanded && messages.length > 0 && (
            <button
              onClick={onExpandAll}
              className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-2)] transition-colors"
              style={{ color: 'var(--color-text-tertiary)' }}
              title="Expand all"
            >
              <ChevronDown size={15} />
            </button>
          )}
          {threadId && (
            <a
              href={`https://mail.google.com/mail/u/0/#inbox/${threadId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-2)] transition-colors"
              style={{ color: 'var(--color-text-tertiary)' }}
              title="Open in Gmail"
            >
              <ExternalLink size={13} />
            </a>
          )}
        </div>
      </div>

      {/* ── Messages + inline reply ─────────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {loading ? (
          <div key={`loading-${threadId}`} className="animate-message-fade-in">
            {/* Subject header */}
            <div
              className="px-6 pt-5 pb-3 flex flex-col gap-1"
              style={{ borderBottom: `1px solid var(--color-surface-2)` }}
            >
              <h2
                className="text-[22px] font-normal leading-snug"
                style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans)' }}
              >
                {thread.subject ?? '(no subject)'}
              </h2>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[13px] font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  {thread.contactName ?? thread.contactEmail ?? 'Unknown'}
                </span>
                {renderThreadMeta?.()}
                {thread.dealName && !renderThreadMeta && (
                  <span className="text-[12px]" style={{ color: 'var(--color-text-tertiary)' }}>
                    · {thread.dealName}
                  </span>
                )}
              </div>
            </div>

            {/* Skeleton Messages */}
            <div className="py-2">
              <MessageSkeleton />
              <MessageSkeleton />
              <MessageSkeleton />
            </div>
          </div>
        ) : (
          <div key={threadId} className="animate-message-fade-in">
            {/* Subject header */}
            <div
              className="px-6 pt-5 pb-3 flex flex-col gap-1"
              style={{ borderBottom: `1px solid var(--color-surface-2)` }}
            >
              <h2
                className="text-[22px] font-normal leading-snug"
                style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans)' }}
              >
                {thread.subject ?? '(no subject)'}
              </h2>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[13px] font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  {thread.contactName ?? thread.contactEmail ?? 'Unknown'}
                </span>
                {thread.responseClassification && (
                  <span
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider"
                    style={{
                      background:
                        thread.responseClassification === 'positive'
                          ? 'var(--color-success-bg)'
                          : thread.responseClassification === 'negative'
                          ? 'var(--color-danger-bg)'
                          : 'var(--color-surface-2)',
                      color:
                        thread.responseClassification === 'positive'
                          ? 'var(--color-success-text)'
                          : thread.responseClassification === 'negative'
                          ? 'var(--color-danger-text)'
                          : 'var(--color-text-secondary)',
                      border: `1px solid ${
                        thread.responseClassification === 'positive'
                          ? 'var(--color-success-border)'
                          : thread.responseClassification === 'negative'
                          ? 'var(--color-danger-border)'
                          : 'var(--color-surface-3)'
                      }`,
                    }}
                  >
                    {thread.responseClassification}
                  </span>
                )}
                {renderThreadMeta?.()}
                {thread.dealName && !renderThreadMeta && (
                  <span className="text-[12px]" style={{ color: 'var(--color-text-tertiary)' }}>
                    · {thread.dealName}
                  </span>
                )}
              </div>
            </div>

            {/* Reply review status banner */}
            {thread.needsReview && (onConfirmReply || onDismissReply || onSnoozeReply) && (
              <div
                className="mx-6 mt-4 p-4 rounded-xl border flex items-center justify-between gap-4 animate-message-fade-in"
                style={{
                  background: 'var(--color-warning-bg)',
                  borderColor: 'var(--color-warning-border)',
                }}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-warning-text)' }} />
                  <div className="space-y-1">
                    <h4 className="text-[13px] font-semibold" style={{ color: 'var(--color-warning-text)' }}>
                      Reply Awaiting Review
                    </h4>
                    <p className="text-[12px] leading-normal text-[var(--color-text-secondary)]">
                      This thread contains a reply that needs to be classified or snoozed.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {onConfirmReply && (
                    <button
                      onClick={() => onConfirmReply(thread)}
                      disabled={reviewLoading}
                      className="h-8 px-3 rounded-lg text-[12px] font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                      style={{ background: 'var(--color-success-solid)', color: '#fff' }}
                    >
                      <Check size={14} />
                      Confirm
                    </button>
                  )}
                  {onDismissReply && (
                    <button
                      onClick={() => onDismissReply(thread)}
                      disabled={reviewLoading}
                      className="h-8 px-3 rounded-lg text-[12px] font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                      style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-secondary)' }}
                    >
                      <X size={14} />
                      Dismiss
                    </button>
                  )}
                  {onSnoozeReply && (
                    <button
                      onClick={() => onSnoozeReply(thread)}
                      disabled={reviewLoading}
                      className="h-8 px-3 rounded-lg text-[12px] font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                      style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-secondary)' }}
                    >
                      <Clock size={14} />
                      Snooze
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Snoozed status banner */}
            {thread.snoozedUntil && (
              <div
                className="mx-6 mt-4 p-4 rounded-xl border flex items-center gap-3 animate-message-fade-in"
                style={{
                  background: 'var(--color-surface-1)',
                  borderColor: 'var(--color-surface-3)',
                }}
              >
                <Clock className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
                <div className="space-y-0.5">
                  <h4 className="text-[13px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    Review Alerts Snoozed
                  </h4>
                  <p className="text-[12px] text-[var(--color-text-secondary)]">
                    Snoozed until {formatEmailFullDate(thread.snoozedUntil)}.
                  </p>
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((msg, idx) => (
              <MessageItem
                key={msg.id}
                msg={msg}
                isExpanded={expandedMessages.has(msg.id)}
                isLast={idx === messages.length - 1}
                activeMenuMsgId={activeMenuMsgId}
                attachmentDealId={attachmentDealId}
                showMessageMenu={showMessageMenu}
                onToggle={onToggleMessage}
                onSetActiveMenuMsgId={(id) => onSetActiveMenuMsgId?.(id)}
                renderMessageMenu={renderMessageMenu}
                renderMessageActions={renderMessageActions}
                renderInlineReply={renderInlineReply}
                lastMessage={lastMessage}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
