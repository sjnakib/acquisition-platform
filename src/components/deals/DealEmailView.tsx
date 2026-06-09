'use client'

import { useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import {
  Mail, Reply, FolderKanban,
  ChevronDown, ChevronUp, ExternalLink, X,
  Minimize2, Maximize2, Edit, Trash2,
  Clock, Archive, MailOpen, Forward, Paperclip,
  MoreVertical,
} from 'lucide-react'
import { toast } from 'sonner'
import { ContactsPanel } from './ContactsPanel'
import { EmailComposer, type ComposeSendData, type EmailComposerHandle, type AttachmentFile } from '@/components/shared/EmailComposer'
import { EmailThreadList, type EmailThread } from '@/components/shared/EmailThreadList'
import { EmailMessagePanel, type EmailMessage } from '@/components/shared/EmailMessagePanel'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

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

  // ── Compose popup ───────────────────────────────────────────────────────
  const [composeOpen, setComposeOpen] = useState(false)
  const [composeMinimized, setComposeMinimized] = useState(false)
  const [composeMode, setComposeMode] = useState<'new' | 'reply' | 'forward' | null>(null)
  const [composerDefaults, setComposerDefaults] = useState<{ to?: string; subject?: string }>({})
  const [draftBody, setDraftBody] = useState('')
  const [draftCc, setDraftCc] = useState('')
  const [sending, setSending] = useState(false)
  const [attachments, setAttachments] = useState<AttachmentFile[]>([])

  const emailComposerRef = useRef<EmailComposerHandle>(null)

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
      await fetch(`/api/deals/${dealId}/emails`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadIds: [selectedThread.threadId], action: 'archive' }),
      })
      setSelectedThread(null)
      setMessages([])
      toast.success('Archived')
    } catch {
      toast.error('Failed to archive')
    }
  }, [dealId, selectedThread])

  // ── Compose ─────────────────────────────────────────────────────────────

  const handleContactEmailClick = useCallback((email: string, _contactId: string) => {
    setComposerDefaults({ to: email })
    setComposeMode('new')
    setComposeMinimized(false)
    setComposeOpen(true)
    setDraftBody('')
    setDraftCc('')
    setAttachments([])
    emailComposerRef.current?.clear()
  }, [])

  const openCompose = useCallback(() => {
    setComposerDefaults({})
    setComposeMode('new')
    setComposeMinimized(false)
    setComposeOpen(true)
    setDraftBody('')
    setDraftCc('')
    setAttachments([])
    emailComposerRef.current?.clear()
  }, [])

  const dismissCompose = useCallback(() => {
    setComposeOpen(false)
    setComposeMinimized(false)
    setComposeMode(null)
    setAttachments([])
    setDraftBody('')
    setDraftCc('')
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

  const handleSend = useCallback(async (data: ComposeSendData) => {
    if (!data.to || !data.subject) return
    setSending(true)
    try {
      const res = await fetch(`/api/deals/${dealId}/emails/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, attachments: attachments.map((a) => a.id) }),
      })
      if (res.ok) {
        toast.success('Email sent')
        dismissCompose()
        if (selectedThread && composeMode === 'reply') fetchMessages(selectedThread.threadId)
      } else {
        const body = await res.json().catch(() => ({}))
        toast.error(body.error ?? 'Failed to send')
      }
    } catch {
      toast.error('Failed to send')
    } finally {
      setSending(false)
    }
  }, [dealId, attachments, dismissCompose, selectedThread, composeMode, fetchMessages])

  const handleReply = useCallback((msg: EmailMessage) => {
    setComposerDefaults({ to: parseSenderEmail(msg.from), subject: `Re: ${msg.subject}` })
    setComposeMode('reply')
    setComposeMinimized(false)
    setComposeOpen(true)
    setDraftBody('')
    setDraftCc('')
    setAttachments([])
    emailComposerRef.current?.clear()
  }, [])

  const handleForward = useCallback((msg: EmailMessage) => {
    setComposerDefaults({ subject: `Fwd: ${msg.subject}` })
    setComposeMode('forward')
    setComposeMinimized(false)
    setComposeOpen(true)
    setDraftBody('')
    setDraftCc('')
    setAttachments([])
    emailComposerRef.current?.clear()
  }, [])

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-1 min-h-0 border rounded-xl overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
        {/* ═══ Thread List (left) ═══════════════════════════════════════════ */}
        <div
          className="w-[360px] flex-shrink-0 flex flex-col border-r"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-0)' }}
        >
          <EmailThreadList
            apiBase={`/api/deals/${dealId}/emails`}
            projectId={projectId ?? ''}
            onThreadClick={handleThreadClick}
            renderMetaRow={(thread) =>
              thread.isPortfolioSibling ? (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium"
                  style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-secondary)' }}>
                  <FolderKanban size={9} />
                  {thread.dealName ?? 'Portfolio'}
                </span>
              ) : null
            }
            renderHeaderActions={() => (
              <button
                onClick={() => { setIncludePortfolio(!includePortfolio); setSelectedThread(null); setMessages([]) }}
                className="flex items-center gap-1.5 h-6 px-2 rounded text-[10px] font-medium transition-colors"
                style={{
                  background: includePortfolio ? 'var(--color-accent-bg)' : 'transparent',
                  color: includePortfolio ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
                }}
                title="Include portfolio emails"
              >
                <FolderKanban size={11} /> Portfolio
              </button>
            )}
            className="border-0 rounded-none"
          />
          <ContactsPanel dealId={dealId} onEmailClick={handleContactEmailClick} />
        </div>

        {/* ═══ Right Panel: Message detail ══════════════════════════════════ */}
        <div className="flex-1 flex flex-col min-w-0" style={{ background: 'var(--color-surface-0)' }}>
          {!selectedThread ? (
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
                  <Edit size={11} /> Compose
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
              renderThreadActions={() => (
                <>
                  {selectedThread.isInbox && (
                    <button onClick={handleArchiveThread}
                      className="h-7 px-2.5 rounded text-[11px] font-medium transition-colors hover:bg-[var(--color-surface-2)] flex items-center gap-1"
                      style={{ color: 'var(--color-text-secondary)' }}>
                      <Archive size={13} /> Archive
                    </button>
                  )}
                  {messages.length > 0 && (
                    <button onClick={() => handleReply(messages[0]!)}
                      className="h-7 px-2.5 rounded text-[11px] font-medium transition-colors hover:bg-[var(--color-surface-2)] flex items-center gap-1"
                      style={{ color: 'var(--color-text-secondary)' }}>
                      <Reply size={13} /> Reply
                    </button>
                  )}
                </>
              )}
              renderMessageMenu={(msg, closeMenu) => (
                <>
                  <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); closeMenu() }} />
                  <div className="absolute right-0 top-7 z-50 w-40 rounded-lg border shadow-lg py-1"
                    style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-surface-2)' }}>
                    <button onClick={(e) => { e.stopPropagation(); closeMenu(); handleReply(msg) }}
                      className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-[var(--color-surface-1)] flex items-center gap-1.5"
                      style={{ color: 'var(--color-text-primary)' }}>
                      <Reply size={11} /> Reply
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); closeMenu(); handleForward(msg) }}
                      className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-[var(--color-surface-1)] flex items-center gap-1.5"
                      style={{ color: 'var(--color-text-primary)' }}>
                      <Forward size={11} /> Forward
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); closeMenu(); setDeleteMsgId(msg.id); setDeleteMsgThreadId(msg.threadId ?? selectedThread?.threadId ?? null) }}
                      className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-[var(--color-surface-1)] flex items-center gap-1.5"
                      style={{ color: 'var(--color-danger-text)' }}>
                      <Trash2 size={11} /> Delete
                    </button>
                  </div>
                </>
              )}
              renderMessageActions={(msg) => (
                <>
                  <button onClick={() => handleReply(msg)}
                    className="h-7 px-2.5 rounded text-[11px] font-medium transition-colors hover:bg-[var(--color-surface-2)] flex items-center gap-1"
                    style={{ color: 'var(--color-text-secondary)' }}>
                    <Reply size={11} /> Reply
                  </button>
                  <button onClick={() => handleForward(msg)}
                    className="h-7 px-2.5 rounded text-[11px] font-medium transition-colors hover:bg-[var(--color-surface-2)] flex items-center gap-1"
                    style={{ color: 'var(--color-text-secondary)' }}>
                    <Forward size={11} /> Forward
                  </button>
                </>
              )}
            />
          )}
        </div>
      </div>

      {/* ═══ Compose popup ═════════════════════════════════════════════════ */}
      {composeOpen && (
        <div
          className={`fixed z-50 bg-[var(--color-surface-0)] border rounded-xl shadow-2xl flex flex-col transition-all ${
            composeMinimized ? 'bottom-4 right-4 w-[360px] h-[48px]' : 'bottom-4 right-4 w-[520px] h-[580px]'
          }`}
          style={{ borderColor: 'var(--color-surface-2)' }}
        >
          <div
            className="flex items-center justify-between px-4 h-[48px] border-b flex-shrink-0 cursor-pointer"
            style={{ borderColor: 'var(--color-surface-2)', background: 'var(--color-surface-1)' }}
            onClick={() => composeMinimized && setComposeMinimized(false)}
          >
            <span className="text-[12px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              {composeMode === 'reply' ? 'Reply' : composeMode === 'forward' ? 'Forward' : 'New Message'}
            </span>
            <div className="flex items-center gap-0.5">
              <button onClick={(e) => { e.stopPropagation(); setComposeMinimized(!composeMinimized) }}
                className="h-6 w-6 flex items-center justify-center rounded hover:bg-[var(--color-surface-2)]"
                style={{ color: 'var(--color-text-tertiary)' }}>
                {composeMinimized ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
              </button>
              <button onClick={(e) => { e.stopPropagation(); dismissCompose() }}
                className="h-6 w-6 flex items-center justify-center rounded hover:bg-[var(--color-surface-2)]"
                style={{ color: 'var(--color-text-tertiary)' }}>
                <X size={14} />
              </button>
            </div>
          </div>
          {!composeMinimized && (
            <div className="flex-1 flex flex-col min-h-0">
              <EmailComposer
                ref={emailComposerRef}
                mode="compose"
                defaultTo={composerDefaults.to ?? ''}
                defaultSubject={composerDefaults.subject ?? ''}
                defaultBody={draftBody}
                defaultCc={draftCc}
                attachments={attachments}
                onBodyChange={setDraftBody}
                onAttach={handleAttach}
                onRemoveAttachment={handleRemoveAttachment}
                onSend={handleSend}
                sending={sending}
              />
            </div>
          )}
        </div>
      )}

      {/* Delete message confirmation */}
      <Dialog open={deleteMsgId !== null} onOpenChange={(open) => { if (!open) setDeleteMsgId(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete message</DialogTitle>
            <DialogDescription>This message will be moved to Trash. This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDeleteMsgId(null)}>Cancel</Button>
            <Button size="sm" onClick={handleDeleteMessage}
              style={{ background: 'var(--color-danger-solid)', color: 'var(--color-text-inverse)' }}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
