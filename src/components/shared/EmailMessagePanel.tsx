'use client'

import { type ReactNode } from 'react'
import { ChevronDown, ChevronUp, Paperclip, MoreVertical, ExternalLink } from 'lucide-react'
import { formatEmailFullDate } from '@/lib/utils'
import type { EmailThread } from '@/components/shared/EmailThreadList'

// ── Types ────────────────────────────────────────────────────────────────────

export interface EmailMessage {
  id: string
  threadId: string | null
  snippet: string
  from: string
  to: string
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
  /** Called when a message's menu action is selected. Return the menu items. */
  renderMessageMenu?: (message: EmailMessage, closeMenu: () => void) => ReactNode
  /** Active menu message ID (for tracking which menu is open). */
  activeMenuMsgId?: string | null
  /** Called to set the active menu message ID. */
  onSetActiveMenuMsgId?: (msgId: string | null) => void
  /** Render custom actions in the thread header (left side). */
  renderThreadActions?: () => ReactNode
  /** Render custom content below the thread subject line. */
  renderThreadMeta?: () => ReactNode
  /** Deal ID for attachment download URLs. */
  attachmentDealId: string
  /** Render per-message action buttons below expanded body. */
  renderMessageActions?: (message: EmailMessage) => ReactNode
  /** Whether to show the message-level action menu (MoreVertical). */
  showMessageMenu?: boolean
  /** Optional Gmail thread link override (campaign uses original thread's deal). */
  gmailThreadId?: string
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
  const match = from.match(/^"([^"]+)"|^(^[^<]+)\s*</)
  if (match) return (match[1] || match[2] || '').trim()
  if (from.includes('@')) return from.split('@')[0] || from
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
}: EmailMessagePanelProps) {
  const expandedCount = expandedMessages.size
  const allExpanded = messages.length > 0 && expandedCount === messages.length
  const threadId = gmailThreadId ?? thread.threadId

  return (
    <div className="flex flex-col h-full">
      {/* Thread header */}
      <div
        className="flex items-center justify-between px-4 h-[53px] border-b flex-shrink-0"
        style={{ borderColor: 'var(--color-surface-2)' }}
      >
        <div className="flex items-center gap-1.5">
          {renderThreadActions?.()}
        </div>
        <div className="flex items-center gap-1.5">
          {expandedCount > 0 && (
            <button onClick={onCollapseAll} className="h-7 w-7 flex items-center justify-center rounded hover:bg-[var(--color-surface-2)]"
              style={{ color: 'var(--color-text-tertiary)' }} title="Collapse all">
              <ChevronUp size={14} />
            </button>
          )}
          {!allExpanded && messages.length > 0 && (
            <button onClick={onExpandAll} className="h-7 w-7 flex items-center justify-center rounded hover:bg-[var(--color-surface-2)]"
              style={{ color: 'var(--color-text-tertiary)' }} title="Expand all">
              <ChevronDown size={14} />
            </button>
          )}
          {threadId && (
            <a
              href={`https://mail.google.com/mail/u/0/#inbox/${threadId}`}
              target="_blank" rel="noopener noreferrer"
              className="h-7 w-7 flex items-center justify-center rounded hover:bg-[var(--color-surface-2)]"
              style={{ color: 'var(--color-text-tertiary)' }} title="Open in Gmail"
            >
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {/* Subject header */}
        <div className="px-5 py-4 border-b bg-[var(--color-surface-0)] flex flex-col gap-1.5" style={{ borderColor: 'var(--color-surface-2)' }}>
          <h3 className="text-[16px] font-semibold tracking-tight" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans)' }}>
            {thread.subject ?? '(no subject)'}
          </h3>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[12px] font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              {thread.contactName ?? thread.contactEmail ?? 'Unknown'}
            </span>
            {renderThreadMeta?.()}
            {thread.dealName && !renderThreadMeta && (
              <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                · {thread.dealName}
              </span>
            )}
          </div>
        </div>

        {messages.map((msg) => {
          const isExpanded = expandedMessages.has(msg.id)
          const own = isOwnMessage(msg.from)
          return (
            <div key={msg.id} className="border-b" style={{ borderColor: 'var(--color-surface-2)' }}>
              {/* Message header — click to expand */}
              <div
                role="button" tabIndex={0}
                onClick={() => onToggleMessage(msg.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleMessage(msg.id) } }}
                className="flex items-start gap-3 px-5 py-3 cursor-pointer hover:bg-[var(--color-surface-1)] transition-colors"
              >
                <div
                  className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
                  style={{
                    background: own ? 'var(--color-accent)' : avatarColor(parseSenderName(msg.from)),
                    color: 'var(--color-text-inverse)',
                  }}
                >
                  {initials(own ? 'Me' : parseSenderName(msg.from))}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                      {own ? 'Me' : parseSenderName(msg.from)}
                    </span>
                    <span className="text-[11px] flex-shrink-0 ml-2" style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-jetbrains-mono)' }}>
                      {formatEmailFullDate(msg.date)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] truncate" style={{ color: 'var(--color-text-tertiary)' }}>
                      {msg.snippet}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* Message actions menu */}
                  {showMessageMenu && renderMessageMenu && (
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onSetActiveMenuMsgId?.(activeMenuMsgId === msg.id ? null : msg.id)
                        }}
                        className="h-6 w-6 flex items-center justify-center rounded hover:bg-[var(--color-surface-2)]"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >
                        <MoreVertical size={12} />
                      </button>
                      {activeMenuMsgId === msg.id && renderMessageMenu(msg, () => onSetActiveMenuMsgId?.(null))}
                    </div>
                  )}
                  {isExpanded ? <ChevronUp size={14} style={{ color: 'var(--color-text-tertiary)' }} /> : <ChevronDown size={14} style={{ color: 'var(--color-text-tertiary)' }} />}
                </div>
              </div>

              {/* Message body — shown when expanded */}
              {isExpanded && (
                <div className="px-5 pb-5">
                  <div className="border-t pt-4" style={{ borderColor: 'var(--color-surface-2)' }}>
                    <div className="text-[12px] mb-3 space-y-1" style={{ color: 'var(--color-text-tertiary)' }}>
                      <div><span className="font-medium" style={{ color: 'var(--color-text-secondary)' }}>From:</span> {msg.from}</div>
                      <div><span className="font-medium" style={{ color: 'var(--color-text-secondary)' }}>To:</span> {msg.to}</div>
                      <div><span className="font-medium" style={{ color: 'var(--color-text-secondary)' }}>Date:</span> {formatEmailFullDate(msg.date)}</div>
                    </div>
                    {/* Email body */}
                    <div
                      className="text-[13px] leading-relaxed email-content"
                      style={{ color: 'var(--color-text-primary)' }}
                      dangerouslySetInnerHTML={{ __html: msg.body || `<p style="color:var(--color-text-tertiary)">(No content)</p>` }}
                    />
                    {/* Attachments */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mt-4 pt-3 border-t flex flex-wrap gap-2" style={{ borderColor: 'var(--color-surface-2)' }}>
                        {msg.attachments.map((att) => (
                          <a
                            key={att.attachmentId}
                            href={`/api/deals/${attachmentDealId}/emails/attachments?messageId=${msg.id}&attachmentId=${att.attachmentId}&filename=${encodeURIComponent(att.filename)}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[11px] font-medium transition-colors hover:bg-[var(--color-surface-1)]"
                            style={{ borderColor: 'var(--color-surface-2)', color: 'var(--color-text-secondary)' }}
                          >
                            <Paperclip size={10} />
                            {renderAttachmentName(att.filename)}
                          </a>
                        ))}
                      </div>
                    )}
                    {/* Per-message action buttons */}
                    {renderMessageActions && (
                      <div className="flex items-center gap-1.5 mt-4">
                        {renderMessageActions(msg)}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
