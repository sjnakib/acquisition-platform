'use client'

import { useState, useCallback, useRef, lazy, Suspense } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { useIsTabActive } from '@/components/ui/tabs'
import {
  Mail,
  Reply,
  FolderKanban,
  AlertTriangle,
  ExternalLink as ExternalLinkIcon,
  X,
  Minimize2,
  Maximize2,
  Edit,
  Trash2,
  Archive,
  Forward,
  ReplyAll,
} from 'lucide-react'
import { toast } from 'sonner'
import { ContactsPanel } from './ContactsPanel'
import {
  EmailThreadList,
  type EmailThread,
  type EmailThreadListHandle,
} from '@/components/shared/EmailThreadList'
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
import type { ComposeSendData, AttachmentFile, EmailComposerHandle } from '@/components/shared/EmailComposer'
import type { EmailMessage } from '@/components/shared/EmailMessagePanel'
import { useGoogleConnection } from '@/lib/hooks/useGoogleConnection'
import { GoogleReconnectDialog } from '@/components/shared/GoogleReconnectDialog'

// ── Lazy-loaded heavy components ────────────────────────────────────────────

const LazyEmailMessagePanel = lazy(() =>
  import('@/components/shared/EmailMessagePanel').then(m => ({ default: m.EmailMessagePanel }))
)

const LazyEmailComposer = lazy(() =>
  import('@/components/shared/EmailComposer').then(m => ({ default: m.EmailComposer }))
)

// ── Helpers ──────────────────────────────────────────────────────────────────

// ── Component ────────────────────────────────────────────────────────────────

interface DealEmailViewProps {
  dealId: string
  dealName: string | null
  projectId?: string
  /** Whether this deal is a portfolio deal (is_portfolio = true). When true, member deal emails are tracked by default. */
  isPortfolioDeal?: boolean
  /** Whether this deal is a member of a portfolio (portfolio_id is set). When true, the Portfolio toggle can include sibling emails. */
  isInPortfolio?: boolean
  reviewThreadId?: string | null
}

export function DealEmailView({
  dealId,
  dealName,
  projectId,
  isPortfolioDeal = false,
  isInPortfolio = false,
  reviewThreadId,
}: DealEmailViewProps) {
  const queryClient = useQueryClient()
  const isActive = useIsTabActive()
  const { status: connStatus, reconnectUrl } = useGoogleConnection(projectId)
  const [reconnectDialogOpen, setReconnectDialogOpen] = useState(false)

  // ── Selected thread ────────────────────────────────────────────────────
  const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null)

  // ── Messages — TanStack Query ──────────────────────────────────────────

  const { data: messages = [], isLoading: messagesLoading } = useQuery<EmailMessage[]>({
    queryKey: ['email-messages', dealId, selectedThread?.threadId],
    queryFn: async () => {
      if (!selectedThread) return []
      const res = await fetch(
        `/api/deals/${dealId}/emails/threads?threadId=${selectedThread.threadId}&dealId=${dealId}`
      )
      if (!res.ok) throw new Error('Failed to fetch messages')
      const data = await res.json()
      return data.messages ?? []
    },
    enabled: isActive && !!selectedThread,
    staleTime: 60_000,
  })

  // ── Expanded messages UI state ─────────────────────────────────────────

  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set())
  const [expandedThreadId, setExpandedThreadId] = useState<string | null>(null)

  if (selectedThread && messages.length > 0 && selectedThread.threadId !== expandedThreadId) {
    setExpandedThreadId(selectedThread.threadId)
    setExpandedMessages(new Set(messages.map((m) => m.id)))
  }

  // ── Active dropdown menu ────────────────────────────────────────────────

  const [activeMenuMsgId, setActiveMenuMsgId] = useState<string | null>(null)

  // ── Delete message confirmation ────────────────────────────────────────

  const [deleteMsgId, setDeleteMsgId] = useState<string | null>(null)
  const [deleteMsgThreadId, setDeleteMsgThreadId] = useState<string | null>(null)

  // ── Compose popup state (floating — for new message only) ───────────────

  const [composeOpen, setComposeOpen] = useState(false)
  const [composeMinimized, setComposeMinimized] = useState(false)
  const [composeFullscreen, setComposeFullscreen] = useState(false)
  const [attachments, setAttachments] = useState<AttachmentFile[]>([])

  const [reviewLoading, setReviewLoading] = useState(false)

  const emailComposerRef = useRef<EmailComposerHandle>(null)
  const threadListRef = useRef<EmailThreadListHandle>(null)

  // ── Connected Google Account Email ─────────────────────────────────────

  const [googleEmail, setGoogleEmail] = useState<string | null>(null)
  const [gmailConnected, setGmailConnected] = useState<boolean | null>(null)

  // ── Inline reply state ─────────────────────────────────────────────────

  const [inlineMode, setInlineMode] = useState<'reply' | 'reply-all' | 'forward'>('reply')
  const [replyTargetMessage, setReplyTargetMessage] = useState<EmailMessage | null>(null)
  const [inlineAttachments, setInlineAttachments] = useState<AttachmentFile[]>([])
  const inlineReplyRef = useRef<InlineReplyBoxHandle>(null)

  // ── Floating compose (popped out) state ─────────────────────────────────

  const [composeTo, setComposeTo] = useState('')
  const [composeCc, setComposeCc] = useState('')
  const [composeBcc, setComposeBcc] = useState('')
  const [composeSubject, setComposeSubject] = useState('')
  const [composeBody, setComposeBody] = useState('')
  const [composeIsReply, setComposeIsReply] = useState(false)
  const [composeIsForward, setComposeIsForward] = useState(false)
  const [composeThreadId, setComposeThreadId] = useState<string | null>(null)
  const [composeInReplyTo, setComposeInReplyTo] = useState<string | null>(null)

  // ── Portfolio toggle ───────────────────────────────────────────────────

  const [includePortfolio, setIncludePortfolio] = useState(isPortfolioDeal)
  const showPortfolioToggle = isPortfolioDeal || isInPortfolio

  // ── TanStack Query: send message mutation ──────────────────────────────

  const sendMutation = useMutation({
    mutationFn: async ({
      data,
      threadId,
      inReplyTo,
      attachmentIds,
    }: {
      data: ComposeSendData
      threadId: string | null
      inReplyTo: string | null
      attachmentIds: string[]
    }) => {
      const res = await fetch(`/api/deals/${dealId}/emails/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          attachment_ids: attachmentIds,
          threadId,
          inReplyTo,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to send')
      }
    },
    onSuccess: (_data, vars) => {
      toast.success('Email sent')
      // Invalidate thread list so the sent thread shows updated status
      queryClient.invalidateQueries({ queryKey: ['email-threads'] })
      queryClient.invalidateQueries({ queryKey: ['deals'] })
      // Refetch messages for the current thread
      if (vars.threadId) {
        queryClient.invalidateQueries({
          queryKey: ['email-messages', dealId, vars.threadId],
        })
      }
    },
    onError: (err) => {
      if (err instanceof Error && err.message.includes('google_auth_expired')) {
        setReconnectDialogOpen(true)
        return
      }
      toast.error(err instanceof Error ? err.message : 'Failed to send')
    },
  })

  // ── TanStack Query: delete message mutation ────────────────────────────

  const deleteMessageMutation = useMutation({
    mutationFn: async ({ messageId, threadId }: { messageId: string; threadId: string }) => {
      const res = await fetch(`/api/deals/${dealId}/emails/threads`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId, messageId, action: 'deleteMessage' }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to delete message')
      }
    },
    onMutate: async ({ messageId }) => {
      // Optimistic removal from messages
      const queryKey = ['email-messages', dealId, selectedThread?.threadId]
      await queryClient.cancelQueries({ queryKey })
      const prev = queryClient.getQueryData<EmailMessage[]>(queryKey)
      queryClient.setQueryData<EmailMessage[]>(queryKey, (old) =>
        (old ?? []).filter((m) => m.id !== messageId)
      )
      return { prev }
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(
          ['email-messages', dealId, selectedThread?.threadId],
          ctx.prev
        )
      }
      toast.error(err instanceof Error ? err.message : 'Failed to delete message')
    },
    onSettled: () => {
      const queryKey = ['email-messages', dealId, selectedThread?.threadId]
      queryClient.invalidateQueries({ queryKey })
    },
  })

  // ── TanStack Query: attachment upload mutation ─────────────────────────

  const uploadAttachmentMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/attachments', { method: 'POST', body: formData })
      if (!res.ok) throw new Error(`Failed to upload ${file.name}`)
      return res.json() as Promise<AttachmentFile>
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Upload failed'),
  })

  // ── Thread click handler ───────────────────────────────────────────────

  const handleThreadClick = useCallback((thread: EmailThread) => {
    setSelectedThread(thread)
    // Reset inline reply when switching thread
    inlineReplyRef.current?.collapse()
    // Mark as read (Gmail convention: opening a thread clears the unread label)
    if (thread.isUnread) {
      threadListRef.current?.handleThreadAction([thread.threadId], 'markRead')
    }
  }, [])

  // ── Message expand/collapse ────────────────────────────────────────────

  const toggleMessage = useCallback((msgId: string) => {
    setExpandedMessages((prev) => {
      const next = new Set(prev)
      if (next.has(msgId)) next.delete(msgId)
      else next.add(msgId)
      return next
    })
  }, [])

  const expandAllMessages = useCallback(() => setExpandedMessages(new Set(messages.map((m) => m.id))), [messages])

  // ── Review Actions ───────────────────────────────────────────────────────

  const reviewAction = useCallback(async (thread: EmailThread, action: 'confirm' | 'dismiss' | 'snooze') => {
    if (!thread.outreachId) return
    setReviewLoading(true)
    try {
      const body: Record<string, unknown> = { review_action: action }
      if (action === 'snooze') {
        const snoozeDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
        body.snoozed_until = snoozeDate.toISOString()
      }
      const res = await fetch(`/api/emails/${thread.outreachId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Action failed')
      }
      const verb = action === 'confirm' ? 'confirmed' : action === 'dismiss' ? 'dismissed' : 'snoozed'
      toast.success(`Reply ${verb}`)

      // Invalidate caches
      queryClient.invalidateQueries({ queryKey: ['email-threads'] })
      queryClient.invalidateQueries({ queryKey: ['deals'] })

      // Update selectedThread state locally
      setSelectedThread((prev) => {
        if (prev && prev.threadId === thread.threadId) {
          return {
            ...prev,
            needsReview: false,
            snoozedUntil: action === 'snooze' ? body.snoozed_until as string : prev.snoozedUntil,
          }
        }
        return prev
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setReviewLoading(false)
    }
  }, [queryClient])

  const handleConfirm = useCallback((thread: EmailThread) => {
    reviewAction(thread, 'confirm')
  }, [reviewAction])

  const handleDismiss = useCallback((thread: EmailThread) => {
    reviewAction(thread, 'dismiss')
  }, [reviewAction])

  const handleSnooze = useCallback((thread: EmailThread) => {
    reviewAction(thread, 'snooze')
  }, [reviewAction])
  const collapseAllMessages = useCallback(() => setExpandedMessages(new Set()), [])

  // ── Delete message handler ─────────────────────────────────────────────

  const handleDeleteMessage = useCallback(() => {
    if (!deleteMsgId || !deleteMsgThreadId) return
    deleteMessageMutation.mutate(
      { messageId: deleteMsgId, threadId: deleteMsgThreadId },
      {
        onSettled: () => {
          setDeleteMsgId(null)
          setDeleteMsgThreadId(null)
        },
      }
    )
  }, [deleteMsgId, deleteMsgThreadId, deleteMessageMutation])

  // ── Archive thread handler ─────────────────────────────────────────────

  const handleArchiveThread = useCallback(async () => {
    if (!selectedThread) return
    try {
      if (threadListRef.current) {
        await threadListRef.current.handleThreadAction([selectedThread.threadId], 'archive')
      }
      setSelectedThread(null)
      toast.success('Archived')
    } catch {
      toast.error('Failed to archive')
    }
  }, [selectedThread])

  // ── Floating compose (new message only) ────────────────────────────────

  const handleContactEmailClick = useCallback((email: string, _contactId: string) => {
    if (!gmailConnected) return
    void _contactId
    setComposeTo(email)
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
    setTimeout(() => {
      emailComposerRef.current?.clear()
    }, 50)
  }, [gmailConnected])

  const openCompose = useCallback(() => {
    if (!gmailConnected) return
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
  }, [gmailConnected])

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

  // ── Attachment handlers (shared between compose and inline) ────────────

  const handleAttach = useCallback(async (files: FileList) => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!file) continue
      try {
        const uploaded = await uploadAttachmentMutation.mutateAsync(file)
        setAttachments((prev) => [...prev, uploaded])
      } catch {
        // Error handled by mutation's onError
      }
    }
  }, [uploadAttachmentMutation])

  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const handleSendNewMessage = useCallback(async (data: ComposeSendData) => {
    if (!data.to || !data.subject) return
    sendMutation.mutate(
      {
        data,
        threadId: composeThreadId,
        inReplyTo: composeInReplyTo,
        attachmentIds: attachments.map((a) => a.id),
      },
      {
        onSuccess: () => dismissCompose(),
      }
    )
  }, [sendMutation, attachments, composeThreadId, composeInReplyTo, dismissCompose])

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
    const threadId = selectedThread?.threadId ?? null
    const inReplyTo = inlineMode !== 'forward' && replyTargetMessage ? (replyTargetMessage.messageId ?? null) : null
    sendMutation.mutate({
      data,
      threadId,
      inReplyTo,
      attachmentIds: inlineAttachments.map((a) => a.id),
    })
  }, [sendMutation, inlineAttachments, selectedThread, inlineMode, replyTargetMessage])

  const handleInlineAttach = useCallback(async (files: FileList) => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!file) continue
      try {
        const uploaded = await uploadAttachmentMutation.mutateAsync(file)
        setInlineAttachments((prev) => [...prev, uploaded])
      } catch {
        // Error handled by mutation's onError
      }
    }
  }, [uploadAttachmentMutation])

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
            enabled={isActive}
            onAuthExpired={() => setReconnectDialogOpen(true)}
            apiBase={`/api/deals/${dealId}/emails`}
            actionApiBase={`/api/deals/${dealId}/emails/threads`}
            includePortfolio={includePortfolio}
            projectId={projectId ?? ''}
            onLoad={({ googleEmail, gmailConnected }) => {
              setGoogleEmail(googleEmail)
              setGmailConnected(gmailConnected)
            }}
            onThreadClick={handleThreadClick}
            selectedThreadId={selectedThread?.threadId || reviewThreadId || null}
            prefetchMessageConfig={(thread) => ({
              queryKey: ['email-messages', dealId, thread.threadId],
              url: `/api/deals/${dealId}/emails/threads?threadId=${thread.threadId}&dealId=${dealId}`,
            })}
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
            renderHeaderActions={() =>
              showPortfolioToggle ? (
                <div className="flex items-center gap-1">
                  {/* Portfolio toggle */}
                  <button
                    onClick={() => {
                      setIncludePortfolio(!includePortfolio)
                      setSelectedThread(null)
                    }}
                    className="flex items-center gap-1.5 h-6 px-2 rounded-full text-[10px] font-medium transition-colors"
                    style={{
                      background: includePortfolio ? 'var(--color-accent-bg)' : 'transparent',
                      color: includePortfolio ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
                    }}
                    title={includePortfolio ? 'Showing portfolio member emails' : 'Include portfolio member emails'}
                  >
                    <FolderKanban size={11} /> {isPortfolioDeal ? 'Members' : 'Portfolio'}
                  </button>
                </div>
              ) : null
            }
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
          <ContactsPanel dealId={dealId} onEmailClick={handleContactEmailClick} isPortfolioDeal={isPortfolioDeal} />
        </div>

        {/* ═══ Right Panel: Message detail ══════════════════════════════════ */}
        <div className="flex-1 flex flex-col min-w-0" style={{ background: 'var(--color-surface-0)' }}>
          {gmailConnected === null ? (
            // Loading connection status
            <div className="flex-1 flex items-center justify-center">
              <LoadingSpinner size="lg" />
            </div>
          ) : !gmailConnected && connStatus === 'expired' ? (
            // Google auth expired state
            <div className="flex-1 flex items-center justify-center animate-message-fade-in">
              <div className="text-center space-y-3 px-6 max-w-md">
                <AlertTriangle size={36} style={{ color: 'var(--color-warning-text)', opacity: 0.7, margin: '0 auto' }} />
                <h3 className="text-[14px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  Google Connection Expired
                </h3>
                <p className="text-[12px] leading-relaxed" style={{ color: 'var(--color-text-tertiary)' }}>
                  Your Google authorization has expired. Reconnect to continue using email and Drive features.
                </p>
                <button
                  onClick={() => setReconnectDialogOpen(true)}
                  className="inline-flex h-8 px-4 rounded-full text-[12px] font-medium transition-colors items-center no-underline mt-2"
                  style={{ background: 'var(--color-accent)', color: 'var(--color-text-inverse)' }}
                >
                  Reconnect Now
                </button>
              </div>
            </div>
          ) : !gmailConnected ? (
            // Gmail disconnected state
            <div className="flex-1 flex items-center justify-center animate-message-fade-in">
              <div className="text-center space-y-3 px-6 max-w-md">
                <Mail size={36} style={{ color: 'var(--color-text-tertiary)', opacity: 0.4, margin: '0 auto' }} />
                <h3 className="text-[14px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  Gmail Connection Required
                </h3>
                <p className="text-[12px] leading-relaxed" style={{ color: 'var(--color-text-tertiary)' }}>
                  Connect your Gmail account in project settings to compose emails, view conversations, and track interactions.
                </p>
                <a
                  href={`/projects/${projectId}/settings`}
                  className="inline-flex h-8 px-4 rounded-full text-[12px] font-medium transition-colors items-center no-underline mt-2"
                  style={{ background: 'var(--color-accent)', color: 'var(--color-text-inverse)' }}
                >
                  Go to Settings
                </a>
              </div>
            </div>
          ) : !selectedThread ? (
            // Empty state
            <div className="flex-1 flex items-center justify-center animate-message-fade-in">
              <div className="text-center space-y-3">
                <Mail size={36} style={{ color: 'var(--color-text-tertiary)', opacity: 0.4, margin: '0 auto' }} />
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
          ) : (
            <Suspense fallback={
              <div className="flex-1 flex items-center justify-center">
                <LoadingSpinner size="md" />
              </div>
            }>
              <LazyEmailMessagePanel
                thread={selectedThread}
                messages={messages}
                loading={messagesLoading}
                expandedMessages={expandedMessages}
                onToggleMessage={toggleMessage}
                onExpandAll={expandAllMessages}
                onCollapseAll={collapseAllMessages}
                attachmentDealId={dealId}
                activeMenuMsgId={activeMenuMsgId}
                onSetActiveMenuMsgId={setActiveMenuMsgId}
                onConfirmReply={handleConfirm}
                onDismissReply={handleDismiss}
                onSnoozeReply={handleSnooze}
                reviewLoading={reviewLoading}

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
                    sending={sendMutation.isPending}
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
            </Suspense>
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

          {/* ── Compose body (lazy loaded) ──────────────────────────── */}
          {!composeMinimized && (
            <div
              className="flex-1 flex flex-col min-h-0"
              style={{ background: 'var(--color-surface-0)' }}
            >
              <Suspense fallback={
                <div className="flex-1 flex items-center justify-center">
                  <LoadingSpinner size="md" />
                </div>
              }>
                <LazyEmailComposer
                  key={`${composeTo}-${composeSubject}-${composeIsReply}-${composeIsForward}-${composeThreadId}`}
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
                  sending={sendMutation.isPending}
                  onDiscard={dismissCompose}
                />
              </Suspense>
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
              {deleteMessageMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Google reconnect dialog ════════════════════════════════════════ */}
      <GoogleReconnectDialog
        open={reconnectDialogOpen}
        onOpenChange={setReconnectDialogOpen}
        reconnectUrl={reconnectUrl ?? `/api/auth/google?projectId=${projectId}`}
        onDismiss={() => setGmailConnected(false)}
      />
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
