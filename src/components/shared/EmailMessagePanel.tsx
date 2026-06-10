'use client'

import { useState, type ReactNode } from 'react'
import {
  ChevronDown, ChevronUp, Paperclip, MoreVertical, ExternalLink,
  ChevronRight,
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
}: EmailMessagePanelProps) {
  const expandedCount = expandedMessages.size
  const allExpanded = messages.length > 0 && expandedCount === messages.length
  const threadId = gmailThreadId ?? thread.threadId
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] ?? null : null

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
      <div className="flex-1 overflow-y-auto">
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

        {/* Messages */}
        {messages.map((msg, idx) => {
          const isExpanded = expandedMessages.has(msg.id)
          const own = isOwnMessage(msg.from)
          const senderName = own ? 'Me' : parseSenderName(msg.from)
          const senderEmail = parseSenderEmail(msg.from)
          const isLast = idx === messages.length - 1

          return (
            <div
              key={msg.id}
              className="border-b"
              style={{ borderColor: 'var(--color-surface-2)' }}
            >
              {/* ── Message header: always visible ────────────────────── */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => onToggleMessage(msg.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onToggleMessage(msg.id)
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
                              onSetActiveMenuMsgId?.(activeMenuMsgId === msg.id ? null : msg.id)
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
                  <div
                    className="text-[14px] leading-relaxed email-content"
                    style={{ color: 'var(--color-text-primary)' }}
                    dangerouslySetInnerHTML={{
                      __html: msg.body || `<p style="color:var(--color-text-tertiary)">(No content)</p>`,
                    }}
                  />

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
        })}
      </div>
    </div>
  )
}
