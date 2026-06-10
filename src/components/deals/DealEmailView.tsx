'use client'

import { useState, useCallback, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import {
  Mail,
  Reply,
  FolderKanban,
  ExternalLink as ExternalLinkIcon,
  X,
  Minimize2,
  Maximize2,
  Edit,
  Trash2,
  Archive,
  Forward,
  MoreVertical,
  ReplyAll,
} from 'lucide-react'
import { toast } from 'sonner'
import { ContactsPanel } from './ContactsPanel'
import {
  EmailComposer,
  type ComposeSendData,
  type EmailComposerHandle,
  type AttachmentFile,
} from '@/components/shared/EmailComposer'
import {
  EmailThreadList,
  type EmailThread,
  type EmailThreadListHandle,
} from '@/components/shared/EmailThreadList'
import {
  EmailMessagePanel,
  type EmailMessage,
} from '@/components/shared/EmailMessagePanel'
import {
  InlineReplyBox,
  type InlineReplyBoxHandle,
} from '@/components/deals/InlineReplyBox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseSenderEmail(from: string): string {
  const match = from.match(/<([^>]+)>/)
  if (match) return match[1] || from
  return from
}

// ── Component ────────────────────────────────────────────────────────────────

interface DealEmailViewProps {
  dealId: string
  dealName: string | null
  projectId?: string
}

export function DealEmailView({ dealId, dealName, projectId }: DealEmailViewProps) {
  // ── Selected thread + messages ─────────────────────────────────────────
  const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null)
  const [messages, setMessages] = useState<EmailMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set())

  // Active dropdown menu
  const [activeMenuMsgId, setActiveMenuMsgId] = useState<string | null>(null)

  // Delete message confirmation
  const [deleteMsgId, setDeleteMsgId] = useState<string | null>(null)
  const [deleteMsgThreadId, setDeleteMsgThreadId] = useState<string | null>(null)

  // ── Compose popup (floating — for new message only) ────────────────────
  const [composeOpen, setComposeOpen] = useState(false)
  const [composeMinimized, setComposeMinimized] = useState(false)
  const [composeFullscreen, setComposeFullscreen] = useState(false)
  const [sending, setSending] = useState(false)
  const [attachments, setAttachments] = useState<AttachmentFile[]>([])

  const emailComposerRef = useRef<EmailComposerHandle>(null)
  const threadListRef = useRef<EmailThreadListHandle>(null)

  // ── Connected Google Account Email ─────────────────────────────────────
  const [googleEmail, setGoogleEmail] = useState<string | null>(null)

  // ── Inline reply state ─────────────────────────────────────────────────
  const [inlineMode, setInlineMode] = useState<'reply' | 'reply-all' | 'forward'>('reply')
  const [replyTargetMessage, setReplyTargetMessage] = useState<EmailMessage | null>(null)
  const [inlineAttachments, setInlineAttachments] = useState<AttachmentFile[]>([])
  const [inlineSending, setInlineSending] = useState(false)
  const inlineReplyRef = useRef<InlineReplyBoxHandle>(null)

  // ── Floating compose (popped out / new compose) state ──────────────────
  const [composeTo, setComposeTo] = useState('')
  const [composeCc, setComposeCc] = useState('')
  const [composeBcc, setComposeBcc] = useState('')
  const [composeSubject, setComposeSubject] = useState('')
  const [composeBody, setComposeBody] = useState('')
  const [composeIsReply, setComposeIsReply] = useState(false)
  const [composeIsForward, setComposeIsForward] = useState(false)
  const [composeThreadId, setComposeThreadId] = useState<string | null>(null)
  const [composeInReplyTo, setComposeInReplyTo] = useState<string | null>(null)

  // ── Portfolio toggle ────────────────────────────────────────────────────
  const [includePortfolio, setIncludePortfolio] = useState(false)

  // ── Message fetching ────────────────────────────────────────────────────

  const fetchMessages = useCallback(async (threadId: string) => {
    setMessagesLoading(true)
    try {
      const res = await fetch(`/api/deals/${dealId}/emails/threads?threadId=${threadId}&dealId=${dealId}`)
      if (res.ok) {
        const data = await res.json()
        const msgs: EmailMessage[] = data.messages ?? []
        setMessages(msgs)
        setExpandedMessages(new Set(msgs.map((m) => m.id)))
        setReplyTargetMessage(msgs[msgs.length - 1] ?? null)
      }
    } catch (err) {
      console.error('[DealEmailView] Message fetch failed:', err)
    } finally {
      setMessagesLoading(false)
    }
  }, [dealId])

  const handleThreadClick = useCallback((thread: EmailThread) => {
    setSelectedThread(thread)
    fetchMessages(thread.threadId)
    // Reset inline reply when switching thread
    inlineReplyRef.current?.collapse()
  }, [fetchMessages])

  // ── Message expand/collapse ─────────────────────────────────────────────

  const toggleMessage = useCallback((msgId: string) => {
    setExpandedMessages((prev) => {
      const next = new Set(prev)
      if (next.has(msgId)) next.delete(msgId)
      else next.add(msgId)
      return next
    })
  }, [])

  const expandAllMessages = useCallback(() => setExpandedMessages(new Set(messages.map((m) => m.id))), [messages])
  const collapseAllMessages = useCallback(() => setExpandedMessages(new Set()), [])

  // ── Message actions ─────────────────────────────────────────────────────

  const handleDeleteMessage = useCallback(async () => {
    if (!deleteMsgId || !deleteMsgThreadId) return
    try {
      const res = await fetch(`/api/deals/${dealId}/emails/threads`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: deleteMsgThreadId, messageId: deleteMsgId, action: 'deleteMessage' }),
      })
      if (res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== deleteMsgId))
        toast.success('Message deleted')
      } else {
        const body = await res.json().catch(() => ({}))
        toast.error(body.error ?? 'Failed to delete message')
      }
    } catch {
      toast.error('Failed to delete message')
    } finally {
      setDeleteMsgId(null)
      setDeleteMsgThreadId(null)
    }
  }, [dealId, deleteMsgId, deleteMsgThreadId])

  const handleArchiveThread = useCallback(async () => {
    if (!selectedThread) return
    try {
      if (threadListRef.current) {
        threadListRef.current.handleThreadAction([selectedThread.threadId], 'archive')
      } else {
        await fetch(`/api/deals/${dealId}/emails/threads`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ threadIds: [selectedThread.threadId], action: 'archive' }),
        })
      }
      setSelectedThread(null)
      setMessages([])
      toast.success('Archived')
    } catch {
      toast.error('Failed to archive')
    }
  }, [dealId, selectedThread])

  // ── Floating compose (new message only) ────────────────────────────────

  const handleContactEmailClick = useCallback((email: string, _contactId: string) => {
    setComposeMinimized(false)
    setComposeFullscreen(false)
    setComposeOpen(true)
    setAttachments([])
    emailComposerRef.current?.clear()
    // Set default to via the ref after a tick so the composer has mounted
    setTimeout(() => {
      emailComposerRef.current?.clear()
    }, 50)
  }, [])

  const openCompose = useCallback(() => {
    setComposeTo('')
    setComposeCc('')
    setComposeBcc('')
    setComposeSubject('')
    setComposeBody('')
    setComposeIsReply(false)
    setComposeIsForward(false)
    setComposeThreadId(null)
    setComposeInReplyTo(null)
    setComposeMinimized(false)
    setComposeFullscreen(false)
    setComposeOpen(true)
    setAttachments([])
    emailComposerRef.current?.clear()
  }, [])

  const dismissCompose = useCallback(() => {
    setComposeOpen(false)
    setComposeMinimized(false)
    setComposeFullscreen(false)
    setAttachments([])
    setComposeTo('')
    setComposeCc('')
    setComposeBcc('')
    setComposeSubject('')
    setComposeBody('')
    setComposeIsReply(false)
    setComposeIsForward(false)
    setComposeThreadId(null)
    setComposeInReplyTo(null)
    emailComposerRef.current?.clear()
  }, [])

  const handleAttach = useCallback(async (files: FileList) => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!file) continue
      try {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/attachments', { method: 'POST', body: formData })
        if (res.ok) {
          const data = await res.json()
          setAttachments((prev) => [...prev, {
            id: data.id, filename: data.filename,
            size_bytes: data.size_bytes, mime_type: data.mime_type,
          }])
        } else {
          toast.error(`Failed to upload ${file.name}`)
        }
      } catch {
        toast.error(`Failed to upload ${file.name}`)
      }
    }
  }, [])

  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const handleSendNewMessage = useCallback(async (data: ComposeSendData) => {
    if (!data.to || !data.subject) return
    setSending(true)
    try {
      const res = await fetch(`/api/deals/${dealId}/emails/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          attachment_ids: attachments.map((a) => a.id),
          threadId: composeThreadId,
          inReplyTo: composeInReplyTo,
        }),
      })
      if (res.ok) {
        toast.success('Email sent')
        dismissCompose()
        if (composeThreadId) {
          fetchMessages(composeThreadId)
        }
      } else {
        const body = await res.json().catch(() => ({}))
        toast.error(body.error ?? 'Failed to send')
      }
    } catch {
      toast.error('Failed to send')
    } finally {
      setSending(false)
    }
  }, [dealId, attachments, composeThreadId, composeInReplyTo, dismissCompose, fetchMessages])

  // ── Inline reply / forward ─────────────────────────────────────────────

  const handleReply = useCallback((msg: EmailMessage) => {
    setReplyTargetMessage(msg)
    setInlineMode('reply')
    setInlineAttachments([])
    inlineReplyRef.current?.expand('reply', msg)
  }, [])

  const handleReplyAll = useCallback((msg: EmailMessage) => {
    setReplyTargetMessage(msg)
    setInlineMode('reply-all')
    setInlineAttachments([])
    inlineReplyRef.current?.expand('reply-all', msg)
  }, [])

  const handleForward = useCallback((msg: EmailMessage) => {
    setReplyTargetMessage(msg)
    setInlineMode('forward')
    setInlineAttachments([])
    inlineReplyRef.current?.expand('forward', msg)
  }, [])

  // "Pop out" inline reply into floating compose
  const handlePopOutReply = useCallback((
    mode: 'reply' | 'reply-all' | 'forward',
    to: string,
    cc: string,
    subject: string,
    body: string
  ) => {
    setComposeTo(to)
    setComposeCc(cc)
    setComposeBcc('')
    setComposeSubject(subject)
    setComposeBody(body)
    setComposeIsReply(mode === 'reply' || mode === 'reply-all')
    setComposeIsForward(mode === 'forward')
    setComposeThreadId(selectedThread?.threadId ?? null)
    setComposeInReplyTo(mode !== 'forward' && replyTargetMessage ? (replyTargetMessage.messageId ?? null) : null)

    setComposeMinimized(false)
    setComposeFullscreen(false)
    setComposeOpen(true)
    setAttachments(inlineAttachments)
    inlineReplyRef.current?.collapse()
  }, [inlineAttachments, selectedThread, replyTargetMessage])

  const handleInlineSend = useCallback(async (data: ComposeSendData) => {
    setInlineSending(true)
    try {
      const threadId = selectedThread?.threadId
      const inReplyTo = inlineMode !== 'forward' && replyTargetMessage ? (replyTargetMessage.messageId ?? null) : null
      const res = await fetch(`/api/deals/${dealId}/emails/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          attachment_ids: inlineAttachments.map((a) => a.id),
          threadId,
          inReplyTo,
        }),
      })
      if (res.ok) {
        toast.success('Email sent')
        if (threadId) fetchMessages(threadId)
      } else {
        const body = await res.json().catch(() => ({}))
        toast.error(body.error ?? 'Failed to send')
      }
    } catch {
      toast.error('Failed to send')
    } finally {
      setInlineSending(false)
    }
  }, [dealId, inlineAttachments, selectedThread, fetchMessages])

  const handleInlineAttach = useCallback(async (files: FileList) => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!file) continue
      try {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/attachments', { method: 'POST', body: formData })
        if (res.ok) {
          const data = await res.json()
          setInlineAttachments((prev) => [...prev, {
            id: data.id, filename: data.filename,
            size_bytes: data.size_bytes, mime_type: data.mime_type,
          }])
        } else {
          toast.error(`Failed to upload ${file.name}`)
        }
      } catch {
        toast.error(`Failed to upload ${file.name}`)
      }
    }
  }, [])

  const handleInlineRemoveAttachment = useCallback((id: string) => {
    setInlineAttachments((prev) => prev.filter((a) => a.id !== id))
  }, [])

  // ── Thread action toolbar icon button helper ──────────────────────────

  const ThreadToolbarBtn = ({
    icon: Icon,
    label,
    onClick,
    danger = false,
  }: {
    icon: typeof Archive
    label: string
    onClick: () => void
    danger?: boolean
  }) => (
    <button
      onClick={onClick}
      className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-2)] transition-colors"
      style={{ color: danger ? 'var(--color-danger-text)' : 'var(--color-text-secondary)' }}
      title={label}
    >
      <Icon size={15} />
    </button>
  )

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex flex-1 min-h-0 border rounded-xl overflow-hidden"
        style={{ borderColor: 'var(--color-border)' }}
      >
        {/* ═══ Thread List (left) ═══════════════════════════════════════════ */}
        <div
          className="w-[360px] flex-shrink-0 flex flex-col border-r"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-0)' }}
        >
          <EmailThreadList
            ref={threadListRef}
            apiBase={`/api/deals/${dealId}/emails`}
            actionApiBase={`/api/deals/${dealId}/emails/threads`}
            projectId={projectId ?? ''}
            onLoad={({ googleEmail }) => setGoogleEmail(googleEmail)}
            onThreadClick={handleThreadClick}
            selectedThreadId={selectedThread?.threadId ?? null}
            renderMetaRow={(thread) =>
              thread.isPortfolioSibling ? (
                <span
                  className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium"
                  style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-secondary)' }}
                >
                  <FolderKanban size={9} />
                  {thread.dealName ?? 'Portfolio'}
                </span>
              ) : null
            }
            renderHeaderActions={() => (
              <div className="flex items-center gap-1">
                {/* Portfolio toggle */}
                <button
                  onClick={() => {
                    setIncludePortfolio(!includePortfolio)
                    setSelectedThread(null)
                    setMessages([])
                  }}
                  className="flex items-center gap-1.5 h-6 px-2 rounded-full text-[10px] font-medium transition-colors"
                  style={{
                    background: includePortfolio ? 'var(--color-accent-bg)' : 'transparent',
                    color: includePortfolio ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
                  }}
                  title="Include portfolio emails"
                >
                  <FolderKanban size={11} /> Portfolio
                </button>
              </div>
            )}
            renderHeaderRightActions={() => (
              <button
                onClick={openCompose}
                className="flex items-center gap-1 h-6 px-2.5 rounded-full text-[11px] font-semibold transition-colors"
                style={{ background: 'var(--color-accent)', color: 'var(--color-text-inverse)' }}
                title="Compose new email"
              >
                <Edit size={11} /> Compose
              </button>
            )}
            className="border-0 rounded-none"
          />
          <ContactsPanel dealId={dealId} onEmailClick={handleContactEmailClick} />
        </div>

        {/* ═══ Right Panel: Message detail ══════════════════════════════════ */}
        <div className="flex-1 flex flex-col min-w-0" style={{ background: 'var(--color-surface-0)' }}>
          {!selectedThread ? (
            // Empty state
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3">
                <Mail size={36} style={{ color: 'var(--color-text-tertiary)', opacity: 0.4 }} />
                <p className="text-[13px]" style={{ color: 'var(--color-text-tertiary)' }}>
                  Select a conversation to view emails
                </p>
                <button
                  onClick={openCompose}
                  className="h-8 px-4 rounded-full text-[12px] font-medium transition-colors inline-flex items-center gap-1.5"
                  style={{ background: 'var(--color-accent)', color: 'var(--color-text-inverse)' }}
                >
                  <Edit size={12} /> Compose
                </button>
              </div>
            </div>
          ) : messagesLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <LoadingSpinner size="md" />
            </div>
          ) : (
            <EmailMessagePanel
              thread={selectedThread}
              messages={messages}
              expandedMessages={expandedMessages}
              onToggleMessage={toggleMessage}
              onExpandAll={expandAllMessages}
              onCollapseAll={collapseAllMessages}
              attachmentDealId={dealId}
              activeMenuMsgId={activeMenuMsgId}
              onSetActiveMenuMsgId={setActiveMenuMsgId}

              // ── Thread toolbar ───────────────────────────────────────
              renderThreadActions={() => (
                <>
                  {selectedThread.isInbox && (
                    <ThreadToolbarBtn icon={Archive} label="Archive" onClick={handleArchiveThread} />
                  )}
                  <ThreadToolbarBtn
                    icon={Trash2}
                    label="Delete"
                    danger
                    onClick={() => {
                      const last = messages[messages.length - 1]
                      if (last) {
                        setDeleteMsgId(last.id)
                        setDeleteMsgThreadId(last.threadId ?? selectedThread.threadId)
                      }
                    }}
                  />
                  {messages.length > 0 && (
                    <>
                      <ThreadToolbarBtn
                        icon={Reply}
                        label="Reply"
                        onClick={() => messages.length > 0 && handleReply(messages[messages.length - 1]!)}
                      />
                      <ThreadToolbarBtn
                        icon={ReplyAll}
                        label="Reply all"
                        onClick={() => messages.length > 0 && handleReplyAll(messages[messages.length - 1]!)}
                      />
                      <ThreadToolbarBtn
                        icon={Forward}
                        label="Forward"
                        onClick={() => messages.length > 0 && handleForward(messages[messages.length - 1]!)}
                      />
                    </>
                  )}
                </>
              )}

              // ── Per-message ⋮ menu ──────────────────────────────────
              renderMessageMenu={(msg, closeMenu) => (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={(e) => { e.stopPropagation(); closeMenu() }}
                  />
                  <div
                    className="absolute right-0 top-8 z-50 w-52 rounded-xl border shadow-lg py-1.5 animate-dropdown-show"
                    style={{
                      background: 'var(--color-surface-0)',
                      borderColor: 'var(--color-surface-2)',
                      boxShadow: 'var(--shadow-lg)',
                    }}
                  >
                    <MenuDividerLabel label="Actions" />
                    <MenuBtn
                      icon={Reply}
                      label="Reply"
                      onClick={() => { closeMenu(); handleReply(msg) }}
                    />
                    <MenuBtn
                      icon={ReplyAll}
                      label="Reply all"
                      onClick={() => { closeMenu(); handleReplyAll(msg) }}
                    />
                    <MenuBtn
                      icon={Forward}
                      label="Forward"
                      onClick={() => { closeMenu(); handleForward(msg) }}
                    />
                    <div className="my-1 border-t" style={{ borderColor: 'var(--color-surface-2)' }} />
                    <MenuBtn
                      icon={ExternalLinkIcon}
                      label="Open in Gmail"
                      onClick={() => {
                        closeMenu()
                        window.open(`https://mail.google.com/mail/u/0/#inbox/${msg.threadId ?? selectedThread?.threadId}`, '_blank')
                      }}
                    />
                    <div className="my-1 border-t" style={{ borderColor: 'var(--color-surface-2)' }} />
                    <MenuBtn
                      icon={Trash2}
                      label="Delete"
                      danger
                      onClick={() => {
                        closeMenu()
                        setDeleteMsgId(msg.id)
                        setDeleteMsgThreadId(msg.threadId ?? selectedThread?.threadId ?? null)
                      }}
                    />
                  </div>
                </>
              )}

              // ── Per-message bottom actions: Reply | Reply All | Forward ─
              renderMessageActions={(msg) => (
                <>
                  <GhostActionBtn
                    icon={Reply}
                    label="Reply"
                    onClick={() => handleReply(msg)}
                  />
                  <GhostActionBtn
                    icon={ReplyAll}
                    label="Reply All"
                    onClick={() => handleReplyAll(msg)}
                  />
                  <GhostActionBtn
                    icon={Forward}
                    label="Forward"
                    onClick={() => handleForward(msg)}
                  />
                </>
              )}

              // ── Inline reply box (Gmail-style, below last message) ──
              renderInlineReply={(_lastMsg) => (
                <InlineReplyBox
                  ref={inlineReplyRef}
                  dealId={dealId}
                  message={replyTargetMessage ?? _lastMsg}
                  googleEmail={googleEmail}
                  mode={inlineMode}
                  sending={inlineSending}
                  attachments={inlineAttachments}
                  onSend={handleInlineSend}
                  onAttach={handleInlineAttach}
                  onRemoveAttachment={handleInlineRemoveAttachment}
                  onPopOut={handlePopOutReply}
                  onCollapse={() => {
                    setInlineAttachments([])
                    setReplyTargetMessage(_lastMsg)
                  }}
                />
              )}
            />
          )}
        </div>
      </div>

      {/* ═══ Floating Compose popup (new message only) ═════════════════════ */}
      {composeOpen && (
        <div
          className={`fixed z-50 flex flex-col transition-all duration-200 ${
            composeFullscreen
              ? 'inset-x-[10vw] inset-y-[5vh] w-auto h-auto rounded-2xl'
              : composeMinimized
              ? 'bottom-0 right-6 w-[320px] h-[40px] rounded-t-xl rounded-b-none'
              : 'bottom-4 right-6 w-[540px] h-[500px] rounded-2xl'
          }`}
          style={{
            // Gmail-spec: dark header + card body
            border: '1px solid rgba(0,0,0,0.2)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.16)',
          }}
        >
          {/* ── Compose header (Gmail dark bar) ────────────────────── */}
          <div
            className="flex items-center justify-between px-4 h-[40px] flex-shrink-0 cursor-pointer select-none"
            style={{
              background: '#3C4043',
              borderRadius: composeMinimized
                ? '10px 10px 0 0'
                : composeFullscreen
                ? '14px 14px 0 0'
                : '14px 14px 0 0',
            }}
            onClick={() => composeMinimized && setComposeMinimized(false)}
          >
            <span className="text-[13px] font-medium" style={{ color: '#FFFFFF' }}>
              New Message
            </span>
            <div className="flex items-center gap-0.5">
              <button
                onClick={(e) => { e.stopPropagation(); setComposeMinimized(!composeMinimized); setComposeFullscreen(false) }}
                className="h-7 w-7 flex items-center justify-center rounded-full transition-colors hover:bg-white/10"
                style={{ color: '#FFFFFF' }}
                title={composeMinimized ? 'Restore' : 'Minimize'}
              >
                <Minimize2 size={13} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setComposeFullscreen(!composeFullscreen); setComposeMinimized(false) }}
                className="h-7 w-7 flex items-center justify-center rounded-full transition-colors hover:bg-white/10"
                style={{ color: '#FFFFFF' }}
                title={composeFullscreen ? 'Restore size' : 'Full screen'}
              >
                <Maximize2 size={13} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); dismissCompose() }}
                className="h-7 w-7 flex items-center justify-center rounded-full transition-colors hover:bg-white/10"
                style={{ color: '#FFFFFF' }}
                title="Close"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* ── Compose body ──────────────────────────────────────────── */}
          {!composeMinimized && (
            <div
              className="flex-1 flex flex-col min-h-0"
              style={{ background: 'var(--color-surface-0)' }}
            >
              <EmailComposer
                ref={emailComposerRef}
                mode="compose"
                dealId={dealId}
                dealName={dealName ?? undefined}
                defaultTo={composeTo}
                defaultCc={composeCc}
                defaultBcc={composeBcc}
                defaultSubject={composeSubject}
                defaultBody={composeBody}
                isReply={composeIsReply}
                isForward={composeIsForward}
                attachments={attachments}
                onAttach={handleAttach}
                onRemoveAttachment={handleRemoveAttachment}
                onSend={handleSendNewMessage}
                sending={sending}
                onDiscard={dismissCompose}
              />
            </div>
          )}
        </div>
      )}

      {/* ═══ Delete message confirmation ════════════════════════════════════ */}
      <Dialog open={deleteMsgId !== null} onOpenChange={(open) => { if (!open) setDeleteMsgId(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete message</DialogTitle>
            <DialogDescription>
              This message will be moved to Trash. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDeleteMsgId(null)}>Cancel</Button>
            <Button
              size="sm"
              onClick={handleDeleteMessage}
              style={{ background: 'var(--color-danger-solid)', color: 'var(--color-text-inverse)' }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Internal sub-components ───────────────────────────────────────────────────

/** Gmail-style ghost outlined action button (Reply | Reply All | Forward) */
function GhostActionBtn({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Reply
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-[13px] font-medium transition-colors hover:bg-[var(--color-surface-1)]"
      style={{
        borderColor: 'var(--color-surface-3)',
        color: 'var(--color-text-secondary)',
      }}
    >
      <Icon size={13} />
      {label}
    </button>
  )
}

/** Dropdown menu item */
function MenuBtn({
  icon: Icon,
  label,
  onClick,
  danger = false,
}: {
  icon: typeof Reply
  label: string
  onClick: (e: React.MouseEvent) => void
  danger?: boolean
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(e) }}
      className="w-full text-left px-4 py-2 text-[13px] flex items-center gap-2.5 transition-colors hover:bg-[var(--color-surface-1)]"
      style={{ color: danger ? 'var(--color-danger-text)' : 'var(--color-text-primary)' }}
    >
      <Icon size={14} style={{ color: danger ? 'var(--color-danger-text)' : 'var(--color-text-tertiary)', flexShrink: 0 }} />
      {label}
    </button>
  )
}

/** Menu section label */
function MenuDividerLabel({ label }: { label: string }) {
  return (
    <div
      className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider"
      style={{ color: 'var(--color-text-tertiary)' }}
    >
      {label}
    </div>
  )
}
