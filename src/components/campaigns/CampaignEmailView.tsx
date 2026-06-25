'use client'

import { useState, useEffect, useCallback, useRef, startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, ExternalLink, Mail, AlertTriangle, Check, X, Clock } from 'lucide-react'
import { EmailThreadList, type EmailThread, type EmailThreadListHandle } from '@/components/shared/EmailThreadList'
import { EmailMessagePanel, type EmailMessage } from '@/components/shared/EmailMessagePanel'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { useGoogleConnection } from '@/lib/hooks/useGoogleConnection'
import { GoogleReconnectDialog } from '@/components/shared/GoogleReconnectDialog'
import { toast } from 'sonner'

interface CampaignEmailViewProps {
  campaignId: string
  projectId: string
  reviewThreadId?: string | null
}

// ── Review Card ────────────────────────────────────────────────────────────────

interface ReviewCardProps {
  thread: EmailThread
  onConfirm: () => void
  onDismiss: () => void
  onSnooze: () => void
  loading: boolean
}

function ReviewCard({ thread, onConfirm, onDismiss, onSnooze, loading }: ReviewCardProps) {
  return (
    <div
      className="rounded-xl border p-5 flex flex-col gap-3"
      style={{
        background: 'var(--color-surface-0)',
        borderColor: 'var(--color-surface-2)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[13px] font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
              {thread.contactName ?? thread.contactEmail ?? 'Unknown'}
            </span>
          </div>
          <p className="text-[12px] font-medium truncate" style={{ color: 'var(--color-text-secondary)' }}>
            {thread.subject ?? '(no subject)'}
          </p>
          <p className="text-[11px] mt-1 line-clamp-2" style={{ color: 'var(--color-text-tertiary)' }}>
            {thread.snippet}
          </p>
        </div>
      </div>

      {/* Property / deal badge */}
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-medium"
          style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-secondary)' }}
        >
          <Building2 size={9} />
          {thread.dealName ?? 'Property'}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t" style={{ borderColor: 'var(--color-surface-2)' }}>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="h-8 px-3 rounded-md text-[12px] font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50"
          style={{ background: 'var(--color-success-solid)', color: '#fff' }}
        >
          <Check size={14} />
          Confirm
        </button>
        <button
          onClick={onDismiss}
          disabled={loading}
          className="h-8 px-3 rounded-md text-[12px] font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50"
          style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-secondary)' }}
        >
          <X size={14} />
          Dismiss
        </button>
        <button
          onClick={onSnooze}
          disabled={loading}
          className="h-8 px-3 rounded-md text-[12px] font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50"
          style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-secondary)' }}
        >
          <Clock size={14} />
          Snooze
        </button>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function CampaignEmailView({ campaignId, projectId, reviewThreadId }: CampaignEmailViewProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { status: connStatus, reconnectUrl } = useGoogleConnection(projectId)
  const [reconnectDialogOpen, setReconnectDialogOpen] = useState(false)

  const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null)
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set())
  const [gmailConnected, setGmailConnected] = useState<boolean | null>(null)
  const threadListRef = useRef<EmailThreadListHandle>(null)

  // ── Review mode state ───────────────────────────────────────────────────────
  const [reviewMode, setReviewMode] = useState(false)
  const [reviewIndex, setReviewIndex] = useState(0)
  const [reviewLoading, setReviewLoading] = useState(false)
  const reviewCardRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const { data: messages = [], isLoading: messagesLoading } = useQuery<EmailMessage[]>({
    queryKey: ['email-messages', selectedThread?.dealId, selectedThread?.threadId],
    queryFn: async () => {
      if (!selectedThread) return []
      const res = await fetch(
        `/api/deals/${selectedThread.dealId}/emails/threads?threadId=${selectedThread.threadId}&dealId=${selectedThread.dealId}`
      )
      if (!res.ok) throw new Error('Failed to fetch messages')
      const data = await res.json()
      return data.messages ?? []
    },
    enabled: !!selectedThread && !reviewMode,
    staleTime: 60_000,
  })

  // Review threads query
  const reviewApiBase = `/api/campaigns/${encodeURIComponent(campaignId)}/emails`
  const { data: reviewThreads = [], isLoading: reviewThreadsLoading } = useQuery<EmailThread[]>({
    queryKey: ['review-threads', campaignId],
    queryFn: async () => {
      const res = await fetch(`${reviewApiBase}?review_mode=true`)
      if (!res.ok) throw new Error('Failed to fetch review threads')
      const json = await res.json()
      return (json.threads ?? []) as EmailThread[]
    },
    staleTime: 30_000,
  })

  // Auto-select reviewThreadId when provided
  const [autoSelectDone, setAutoSelectDone] = useState(false)
  useEffect(() => {
    if (autoSelectDone || !reviewThreadId || reviewThreads.length === 0) return
    const match = reviewThreads.find((t) => t.threadId === reviewThreadId)
    if (match) {
      startTransition(() => {
        setSelectedThread(match)
        setReviewMode(false)
        setAutoSelectDone(true)
      })
    }
  }, [reviewThreadId, reviewThreads, autoSelectDone])

  const [expandedThreadId, setExpandedThreadId] = useState<string | null>(null)

  useEffect(() => {
    if (selectedThread && messages.length > 0 && selectedThread.threadId !== expandedThreadId) {
      startTransition(() => {
        setExpandedThreadId(selectedThread.threadId)
        setExpandedMessages(new Set(messages.map((m) => m.id)))
      })
    }
  }, [selectedThread, messages, expandedThreadId])

  const handleThreadClick = useCallback((thread: EmailThread) => {
    setSelectedThread(thread)
    setReviewMode(false)
    if (thread.isUnread) {
      threadListRef.current?.handleThreadAction([thread.threadId], 'markRead')
    }
  }, [])

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

  // ── Review actions ────────────────────────────────────────────────────

  const reviewAction = useCallback(async (thread: EmailThread, action: 'confirm' | 'dismiss' | 'snooze') => {
    if (!thread.outreachId) return
    setReviewLoading(true)
    try {
      const body: Record<string, unknown> = { review_action: action }
      if (action === 'snooze') {
        // Snooze for 3 days by default
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
      queryClient.invalidateQueries({ queryKey: ['review-threads', campaignId] })
      queryClient.invalidateQueries({ queryKey: ['deals', { campaign_id: campaignId }] })
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
  }, [campaignId, queryClient])

  const handleConfirm = useCallback((thread: EmailThread) => {
    reviewAction(thread, 'confirm')
  }, [reviewAction])

  const handleDismiss = useCallback((thread: EmailThread) => {
    reviewAction(thread, 'dismiss')
  }, [reviewAction])

  const handleSnooze = useCallback((thread: EmailThread) => {
    reviewAction(thread, 'snooze')
  }, [reviewAction])

  // Clamp reviewIndex when thread list shrinks (after confirm/dismiss/snooze)
  useEffect(() => {
    if (reviewThreads.length === 0) {
      startTransition(() => setReviewIndex(0))
    } else if (reviewIndex >= reviewThreads.length) {
      startTransition(() => setReviewIndex(Math.max(0, reviewThreads.length - 1)))
    }
  }, [reviewThreads.length, reviewIndex])

  // Scroll current review card into view when index changes
  useEffect(() => {
    const current = reviewThreads[reviewIndex]
    if (!current) return
    const el = reviewCardRefs.current.get(current.threadId)
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [reviewIndex, reviewThreads])

  // ── Keyboard shortcuts ────────────────────────────────────────────────

  useEffect(() => {
    if (!reviewMode || reviewThreads.length === 0) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (reviewLoading) return
      // Don't intercept when focus is in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement)?.isContentEditable) return

      const current = reviewThreads[reviewIndex]
      if (!current) return

      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault()
        handleConfirm(current)
      } else if (e.key === 'ArrowLeft' || e.key === 'Escape') {
        e.preventDefault()
        handleDismiss(current)
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        handleSnooze(current)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [reviewMode, reviewThreads, reviewIndex, reviewLoading, handleConfirm, handleDismiss, handleSnooze])

  // ── Navigation ──────────────────────────────────────────────────────────

  const navigateToDeal = useCallback((e: React.MouseEvent, dealId: string) => {
    e.stopPropagation()
    router.push(`/projects/${projectId}/deals/${dealId}?tab=emails`)
  }, [router, projectId])

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Review mode toggle bar */}
      {gmailConnected && (
        <div className="flex items-center gap-2 mb-2 flex-shrink-0">
          <button
            onClick={() => { setReviewMode(false); setSelectedThread(null) }}
            className="h-7 px-3 rounded-full text-[11px] font-medium transition-colors"
            style={{
              background: !reviewMode ? 'var(--accent)' : 'var(--color-surface-2)',
              color: !reviewMode ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
            }}
          >
            View All Emails
          </button>
          <button
            onClick={() => { setReviewMode(true); setSelectedThread(null); setReviewIndex(0) }}
            className="h-7 px-3 rounded-full text-[11px] font-medium transition-colors flex items-center gap-1"
            style={{
              background: reviewMode ? 'var(--accent)' : 'var(--color-surface-2)',
              color: reviewMode ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
            }}
          >
            Review Replies
            {reviewThreads.length > 0 && (
              <span
                className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[10px] font-bold"
                style={{
                  background: reviewMode ? 'rgba(255,255,255,0.25)' : 'var(--color-warning-bg)',
                  color: reviewMode ? 'var(--color-text-inverse)' : 'var(--color-warning-text)',
                }}
              >
                {reviewThreads.length}
              </span>
            )}
          </button>
        </div>
      )}

      {reviewMode ? (
        /* ═══ Review Mode ════════════════════════════════════════════════════ */
        <div className="flex-1 flex flex-col min-h-0">
          {reviewThreadsLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <LoadingSpinner size="lg" />
            </div>
          ) : reviewThreads.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3">
                <Check size={36} style={{ color: 'var(--color-success-text)', opacity: 0.5, margin: '0 auto' }} />
                <p className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
                  No replies awaiting review
                </p>
                <p className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                  All caught up! Switch to View All Emails to browse threads.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Progress bar */}
              <div className="flex-shrink-0 mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                    Reviewing {Math.min(reviewIndex + 1, reviewThreads.length)} of {reviewThreads.length}
                  </span>
                  <span className="text-[11px] font-mono" style={{ color: 'var(--color-text-tertiary)' }}>
                    {Math.round(((reviewIndex) / reviewThreads.length) * 100)}%
                  </span>
                </div>
                <div className="h-1 w-full rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${((reviewIndex) / reviewThreads.length) * 100}%`,
                      backgroundColor: 'var(--accent)',
                    }}
                  />
                </div>
              </div>

              {/* Review cards */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-3">
                {reviewThreads.map((thread) => (
                  <div
                    key={thread.threadId}
                    ref={(el) => {
                      if (el) reviewCardRefs.current.set(thread.threadId, el)
                      else reviewCardRefs.current.delete(thread.threadId)
                    }}
                  >
                    <ReviewCard
                      thread={thread}
                      onConfirm={() => handleConfirm(thread)}
                      onDismiss={() => handleDismiss(thread)}
                      onSnooze={() => handleSnooze(thread)}
                      loading={reviewLoading}
                    />
                  </div>
                ))}
              </div>

              {/* Keyboard hint */}
              <div className="flex-shrink-0 flex items-center gap-4 pt-2 mt-1 border-t" style={{ borderColor: 'var(--color-surface-2)' }}>
                <span className="text-[10px] flex items-center gap-1" style={{ color: 'var(--color-text-tertiary)' }}>
                  <kbd className="px-1 py-px rounded text-[9px]" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-surface-3)' }}>→</kbd>
                  Confirm
                </span>
                <span className="text-[10px] flex items-center gap-1" style={{ color: 'var(--color-text-tertiary)' }}>
                  <kbd className="px-1 py-px rounded text-[9px]" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-surface-3)' }}>←</kbd>
                  Dismiss
                </span>
                <span className="text-[10px] flex items-center gap-1" style={{ color: 'var(--color-text-tertiary)' }}>
                  <kbd className="px-1 py-px rounded text-[9px]" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-surface-3)' }}>S</kbd>
                  Snooze
                </span>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ═══ Normal Mode ════════════════════════════════════════════════════ */
        <div className="flex flex-1 min-h-0 border rounded-xl overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
          {/* ═══ Thread List (left) ═══════════════════════════════════════════ */}
          <div
            className="w-[360px] flex-shrink-0 flex flex-col border-r"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-0)' }}
          >
            <EmailThreadList
              ref={threadListRef}
              onAuthExpired={() => setReconnectDialogOpen(true)}
              apiBase={reviewApiBase}
              projectId={projectId}
              onThreadClick={handleThreadClick}
              selectedThreadId={selectedThread?.threadId ?? null}
              onLoad={({ gmailConnected }) => setGmailConnected(gmailConnected)}
              prefetchMessageConfig={(thread) => ({
                queryKey: ['email-messages', thread.dealId, thread.threadId],
                url: `/api/deals/${thread.dealId}/emails/threads?threadId=${thread.threadId}&dealId=${thread.dealId}`,
              })}
              renderMetaRow={(thread) => (
                <button
                  onClick={(e) => navigateToDeal(e, thread.dealId)}
                  className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium transition-colors hover:opacity-80 max-w-[180px]"
                  style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-secondary)' }}
                  title={`Open ${thread.dealName ?? 'deal'} emails`}
                >
                  <Building2 size={9} />
                  <span className="truncate">{thread.dealName ?? 'Property'}</span>
                  <ExternalLink size={8} className="flex-shrink-0 opacity-60" />
                </button>
              )}
              className="border-0 rounded-none"
            />
          </div>

          {/* ═══ Right Panel: Message detail ══════════════════════════════════ */}
          <div className="flex-1 flex flex-col min-w-0" style={{ background: 'var(--color-surface-0)' }}>
            {gmailConnected === null ? (
              <div className="flex-1 flex items-center justify-center">
                <LoadingSpinner size="lg" />
              </div>
            ) : !gmailConnected && connStatus === 'expired' ? (
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
              <div className="flex-1 flex items-center justify-center animate-message-fade-in">
                <div className="text-center space-y-3">
                  <Mail size={36} style={{ color: 'var(--color-text-tertiary)', opacity: 0.4, margin: '0 auto' }} />
                  <p className="text-[13px]" style={{ color: 'var(--color-text-tertiary)' }}>
                    Select a conversation to view emails
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                    Emails are tracked across all deals in this campaign.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto">
                  <EmailMessagePanel
                    thread={selectedThread}
                    messages={messages}
                    loading={messagesLoading}
                    expandedMessages={expandedMessages}
                    onToggleMessage={toggleMessage}
                    onExpandAll={expandAllMessages}
                    onCollapseAll={collapseAllMessages}
                    attachmentDealId={selectedThread.dealId}
                    showMessageMenu={false}
                    gmailThreadId={selectedThread.threadId}
                    onConfirmReply={handleConfirm}
                    onDismissReply={handleDismiss}
                    onSnoozeReply={handleSnooze}
                    reviewLoading={reviewLoading}
                    renderThreadActions={() => (
                      <button
                        onClick={(e) => navigateToDeal(e, selectedThread.dealId)}
                        className="h-7 px-2.5 rounded text-[11px] font-medium transition-colors hover:bg-[var(--color-surface-2)] flex items-center gap-1"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        <ExternalLink size={12} />
                        Open in Deal
                      </button>
                    )}
                    renderThreadMeta={() => (
                      <button
                        onClick={(e) => navigateToDeal(e, selectedThread.dealId)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium transition-colors hover:underline"
                        style={{ color: 'var(--color-accent)' }}
                      >
                        <Building2 size={10} />
                        {selectedThread.dealName ?? 'Property'}
                      </button>
                    )}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
