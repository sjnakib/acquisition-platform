'use client'

import { useState, useEffect, useCallback, useMemo, type ReactNode, forwardRef, useImperativeHandle, memo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Mail, RefreshCw, Archive, Trash2,
  Clock, MailOpen, Check, X, Star,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatEmailDate } from '@/lib/utils'


// ── Types ────────────────────────────────────────────────────────────────────

export interface EmailThread {
  threadId: string
  subject: string | null
  snippet: string | null
  dealName: string | null
  dealId: string
  contactName: string | null
  contactEmail: string | null
  status: string
  lastDate: string | null
  responseClassification: string | null
  messageCount: number
  isPortfolioSibling: boolean
  isUnread: boolean
  isInbox: boolean
  snoozedUntil: string | null
}

export interface EmailThreadListProps {
  /** Base URL for fetching threads (GET) and performing actions (PATCH). */
  apiBase: string
  /** Optional separate URL for performing actions (PATCH). Defaults to apiBase. */
  actionApiBase?: string
  /** Project ID for Gmail disconnect CTA link. */
  projectId: string
  /** Called when a thread row is clicked. */
  onThreadClick: (thread: EmailThread) => void
  /** ID of the currently selected thread (for active row highlight). */
  selectedThreadId?: string | null
  /** Render extra content below the subject/snippet line (e.g. deal badge, portfolio indicator). */
  renderMetaRow?: (thread: EmailThread) => ReactNode
  /** Render extra actions in the header row (e.g. portfolio toggle, compose button). */
  renderHeaderActions?: () => ReactNode
  /** Render extra actions on the right of the refresh button. */
  renderHeaderRightActions?: () => ReactNode
  /** Show the select-all checkbox and folder tabs row. Default true. */
  showToolbar?: boolean
  /** Optional className for the root element. */
  className?: string
  /** Called when threads load, passing connection-level meta. */
  onLoad?: (data: { googleEmail: string | null; gmailConnected: boolean }) => void
  /** Optional: return a URL to prefetch messages for a thread on hover. */
  prefetchMessageUrl?: (thread: EmailThread) => string | null
  /** Optional: return queryKey + queryFn for prefetching messages on hover. */
  prefetchMessageConfig?: (thread: EmailThread) => { queryKey: unknown[]; url: string } | null
  /** When false, disables the thread list query. Default true. Use for gating
   *  data fetching on tab visibility with keepMounted tabs. */
  enabled?: boolean
  /** Called when the server returns google_auth_expired (tokens were valid but now expired). */
  onAuthExpired?: () => void
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function threadInitials(name: string | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((w) => w[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function threadAvatarColor(name: string | null): string {
  let hash = 0
  const str = name ?? '?'
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return `hsl(${hash % 360}, 55%, 50%)`
}



// ── API response shape ───────────────────────────────────────────────────────

interface ThreadQueryResult {
  threads: EmailThread[]
  gmailConnected: boolean
  googleEmail: string | null
}

// ── Memoized Thread Row ──────────────────────────────────────────────────────

interface ThreadRowProps {
  thread: EmailThread
  isChecked: boolean
  isStarred: boolean
  isActive: boolean
  hasSelection: boolean
  onToggleSelection: (threadId: string) => void
  onToggleStar: (threadId: string, e: React.MouseEvent) => void
  onClick: (thread: EmailThread) => void
  onArchive: (threadId: string, e: React.MouseEvent) => void
  onToggleRead: (threadId: string, isUnread: boolean, e: React.MouseEvent) => void
  onDelete: (threadId: string, e: React.MouseEvent) => void
  renderMetaRow?: (thread: EmailThread) => ReactNode
  onMouseEnter?: () => void
}

const ThreadRow = memo(function ThreadRow({
  thread,
  isChecked,
  isStarred,
  isActive,
  hasSelection,
  onToggleSelection,
  onToggleStar,
  onClick,
  onArchive,
  onToggleRead,
  onDelete,
  renderMetaRow,
  onMouseEnter,
}: ThreadRowProps) {
  return (
    <div
      className="group relative border-b transition-colors"
      style={{
        borderColor: 'var(--color-surface-2)',
        background: isActive
          ? 'var(--color-accent-bg)'
          : isChecked
          ? 'var(--color-surface-1)'
          : thread.isUnread
          ? 'var(--color-surface-0)'
          : 'var(--color-canvas)',
      }}
      onMouseEnter={(e) => {
        onMouseEnter?.()
        if (!isActive) {
          ;(e.currentTarget as HTMLElement).style.background = 'var(--color-surface-1)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          ;(e.currentTarget as HTMLElement).style.background = isChecked
            ? 'var(--color-surface-1)'
            : thread.isUnread
            ? 'var(--color-surface-0)'
            : 'var(--color-canvas)'
        }
      }}
    >
      {/* Active left indicator */}
      {isActive && (
        <div
          className="absolute left-0 top-0 bottom-0 w-0.5 rounded-r"
          style={{ background: 'var(--color-accent)' }}
        />
      )}

      <div className="flex items-center min-h-[52px] px-3 gap-2">
        {/* ── Checkbox (hidden until hover or selection) ───────────── */}
        <div
          className={`flex-shrink-0 transition-opacity ${
            hasSelection ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSelection(thread.threadId) }}
            className="h-4 w-4 rounded border flex items-center justify-center transition-colors"
            style={{
              borderColor: isChecked ? 'var(--color-accent)' : 'var(--color-surface-3)',
              background: isChecked ? 'var(--color-accent)' : 'transparent',
            }}
            title={isChecked ? 'Deselect' : 'Select'}
          >
            {isChecked && <Check size={10} style={{ color: 'var(--color-text-inverse)' }} />}
          </button>
        </div>

        {/* ── Star (always visible) ──────────────────────────────── */}
        <button
          onClick={(e) => onToggleStar(thread.threadId, e)}
          className="flex-shrink-0 h-5 w-5 flex items-center justify-center transition-colors hover:scale-110"
          style={{ color: isStarred ? '#F4B400' : 'var(--color-surface-3)', transition: 'color 0.15s, transform 0.15s' }}
          title={isStarred ? 'Unstar' : 'Star'}
        >
          <Star size={14} fill={isStarred ? '#F4B400' : 'none'} />
        </button>

        {/* ── Clickable row content ──────────────────────────────── */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => onClick(thread)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onClick(thread)
            }
          }}
          className="flex-1 flex items-center gap-3 min-w-0 text-left cursor-pointer outline-none py-2"
        >
          {/* Avatar */}
          <div
            className="h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold"
            style={{
              background: threadAvatarColor(thread.contactName),
              color: 'var(--color-text-inverse)',
            }}
          >
            {threadInitials(thread.contactName)}
          </div>

          {/* Text content */}
          <div className="flex-1 min-w-0">
            {/* Row 1: Sender name + message count + date */}
            <div className="flex items-center justify-between gap-2">
              <span
                className="text-[14px] truncate font-medium"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {thread.contactName ?? thread.contactEmail ?? 'Unknown'}
                {thread.messageCount > 1 && (
                  <span
                    className="ml-1 text-[12px] font-normal"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  >
                    ({thread.messageCount})
                  </span>
                )}
              </span>
              {/* Timestamp — hides on hover, replaced by action icons */}
              <span
                className="text-[12px] flex-shrink-0 ml-2 transition-opacity group-hover:opacity-0"
                style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-jetbrains-mono)' }}
              >
                {formatEmailDate(thread.lastDate)}
              </span>
            </div>

            {/* Row 2: Subject — snippet */}
            <p className="text-[14px] truncate mt-0.5">
              <span
                className="font-normal"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {thread.subject ?? '(no subject)'}
              </span>
              {thread.snippet && (
                <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>
                  {' '}—{' '}{thread.snippet}
                </span>
              )}
            </p>

            {/* Row 3: Meta badges (consumer slot + built-in) */}
            {(renderMetaRow || thread.snoozedUntil || thread.status === 'replied') && (
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {renderMetaRow?.(thread)}
                {thread.status === 'replied' && (
                  <span className="text-[10px] font-medium" style={{ color: 'var(--color-success-text)' }}>Replied</span>
                )}
                {thread.snoozedUntil && (
                  <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                    <Clock size={9} /> Snoozed
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Hover actions (replace timestamp area) ──────────────── */}
      <div
        className="absolute right-0 top-0 bottom-0 hidden group-hover:flex items-center pl-10 pr-3"
        style={{
          pointerEvents: 'none',
          background: `linear-gradient(90deg, transparent 0%, ${
            isActive ? 'var(--color-accent-bg)' : 'var(--color-surface-1)'
          } 40px, ${
            isActive ? 'var(--color-accent-bg)' : 'var(--color-surface-1)'
          } 100%)`
        }}
      >
        <div style={{ pointerEvents: 'auto' }} className="flex items-center gap-0.5">
          {thread.isInbox && (
            <ActionIconBtn
              icon={Archive}
              label="Archive"
              onClick={(e) => onArchive(thread.threadId, e)}
            />
          )}
          <ActionIconBtn
            icon={thread.isUnread ? MailOpen : Mail}
            label={thread.isUnread ? 'Mark as read' : 'Mark as unread'}
            onClick={(e) => onToggleRead(thread.threadId, thread.isUnread, e)}
          />
          <ActionIconBtn
            icon={Trash2}
            label="Delete"
            onClick={(e) => onDelete(thread.threadId, e)}
          />
        </div>
      </div>
    </div>
  )
}, (prev, next) => {
  return prev.thread === next.thread &&
    prev.isChecked === next.isChecked &&
    prev.isStarred === next.isStarred &&
    prev.isActive === next.isActive &&
    prev.hasSelection === next.hasSelection
})

// ── Component ────────────────────────────────────────────────────────────────

export interface EmailThreadListHandle {
  handleThreadAction: (ids: string[], action: string) => Promise<void>
}

export const EmailThreadList = forwardRef<EmailThreadListHandle, EmailThreadListProps>(
  function EmailThreadList({
    apiBase,
    actionApiBase,
    onThreadClick,
    selectedThreadId,
    renderMetaRow,
    renderHeaderActions,
    renderHeaderRightActions,
    showToolbar = true,
    className,
    onLoad,
    prefetchMessageConfig,
    enabled = true,
    onAuthExpired,
  }, ref) {
    const patchUrl = actionApiBase ?? apiBase
    const queryClient = useQueryClient()

    // ── UI state (not server state) ──────────────────────────────────────────
    const [folder, setFolder] = useState<'inbox' | 'sent' | 'archived'>('inbox')
    const [selectedThreadIds, setSelectedThreadIds] = useState<Set<string>>(new Set())
    const [starredThreadIds, setStarredThreadIds] = useState<Set<string>>(new Set())
    const [pendingActionsCount, setPendingActionsCount] = useState(0)

    // ── TanStack Query: thread list ──────────────────────────────────────────

    const {
      data: queryResult,
      isLoading,
      isFetching,
    } = useQuery<ThreadQueryResult>({
      queryKey: ['email-threads', apiBase, folder],
      queryFn: async () => {
        const res = await fetch(`${apiBase}?folder=${folder}`)
        if (res.ok) {
          const data = await res.json()
          return {
            threads: data.threads ?? [],
            gmailConnected: data.gmailConnected ?? true,
            googleEmail: data.googleEmail ?? null,
          }
        }
        if (res.status === 401) {
          const body = await res.json().catch(() => ({}))
          if (body.error === 'google_auth_expired') {
            onAuthExpired?.()
          }
          // Auth expired — return disconnected state so UI shows reconnect banner
          return { threads: [], gmailConnected: false, googleEmail: null }
        }
        if (res.status === 400) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error ?? 'Gmail not connected')
        }
        throw new Error('Failed to load email threads')
      },
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      enabled: enabled !== false,
    })

    const threads = useMemo(() => queryResult?.threads ?? [], [queryResult?.threads])
    const gmailConnected = queryResult?.gmailConnected ?? true

    // ── onLoad callback (debounced via ref compare) ──────────────────────────

    const onLoadRef = useRef(onLoad)
    useEffect(() => {
      onLoadRef.current = onLoad
    }, [onLoad])
    const prevGoogleEmailRef = useRef<string | null | undefined>(undefined)
    const prevGmailConnectedRef = useRef<boolean | undefined>(undefined)

    useEffect(() => {
      const googleEmail = queryResult?.googleEmail ?? null
      const gmailConnected = queryResult?.gmailConnected ?? false
      if (
        googleEmail !== prevGoogleEmailRef.current ||
        gmailConnected !== prevGmailConnectedRef.current
      ) {
        prevGoogleEmailRef.current = googleEmail
        prevGmailConnectedRef.current = gmailConnected
        onLoadRef.current?.({ googleEmail, gmailConnected })
      }
    }, [queryResult])

    // ── TanStack Query: thread actions mutation ──────────────────────────────

    const threadActionMutation = useMutation({
      mutationFn: async ({ ids, action }: { ids: string[]; action: string }) => {
        const res = await fetch(patchUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ threadIds: ids, action }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error ?? 'Action failed')
        }
      },
      onMutate: async ({ ids, action }) => {
        await queryClient.cancelQueries({ queryKey: ['email-threads', apiBase, folder] })
        const prev = queryClient.getQueryData<ThreadQueryResult>(['email-threads', apiBase, folder])

        queryClient.setQueryData<ThreadQueryResult>(['email-threads', apiBase, folder], (old) => {
          if (!old) return undefined
          let updatedThreads = [...old.threads]
          if (action === 'archive' || action === 'delete') {
            updatedThreads = updatedThreads.filter((t) => !ids.includes(t.threadId))
          } else if (action === 'markRead') {
            updatedThreads = updatedThreads.map((t) =>
              ids.includes(t.threadId) ? { ...t, isUnread: false } : t
            )
          } else if (action === 'markUnread') {
            updatedThreads = updatedThreads.map((t) =>
              ids.includes(t.threadId) ? { ...t, isUnread: true } : t
            )
          }
          return { ...old, threads: updatedThreads }
        })

        return { prev }
      },
      onError: (err, _vars, ctx) => {
        if (ctx?.prev) {
          queryClient.setQueryData(['email-threads', apiBase, folder], ctx.prev)
        }
        toast.error(err instanceof Error ? err.message : 'Action failed')
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: ['email-threads', apiBase, folder] })
      },
    })



    // ── Tab close prevention ─────────────────────────────────────────────────

    useEffect(() => {
      if (pendingActionsCount === 0) return

      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault()
        e.returnValue = 'Background activity is in progress. Are you sure you want to leave?'
        return e.returnValue
      }

      window.addEventListener('beforeunload', handleBeforeUnload)
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload)
      }
    }, [pendingActionsCount])

    // ── Selection ────────────────────────────────────────────────────────────

    const hasSelection = selectedThreadIds.size > 0

    const toggleThreadSelection = useCallback((threadId: string) => {
      setSelectedThreadIds((prev) => {
        const next = new Set(prev)
        if (next.has(threadId)) next.delete(threadId)
        else next.add(threadId)
        return next
      })
    }, [])

    const selectAllThreads = useCallback(() => {
      setSelectedThreadIds(new Set(threads.map((t) => t.threadId)))
    }, [threads])

    const clearSelection = useCallback(() => {
      setSelectedThreadIds(new Set())
    }, [])

    // ── Star ─────────────────────────────────────────────────────────────────

    const toggleStar = useCallback((threadId: string, e: React.MouseEvent) => {
      e.stopPropagation()
      setStarredThreadIds((prev) => {
        const next = new Set(prev)
        if (next.has(threadId)) next.delete(threadId)
        else next.add(threadId)
        return next
      })
    }, [])

    // ── Thread actions (called from UI buttons) ──────────────────────────────

    const handleArchive = useCallback((threadId: string, e: React.MouseEvent) => {
      e.stopPropagation()
      setSelectedThreadIds(new Set())
      setPendingActionsCount((prev) => prev + 1)
      threadActionMutation.mutate(
        { ids: [threadId], action: 'archive' },
        { onSettled: () => setPendingActionsCount((prev) => Math.max(0, prev - 1)) }
      )
    }, [threadActionMutation])

    const handleDelete = useCallback((threadId: string, e: React.MouseEvent) => {
      e.stopPropagation()
      setSelectedThreadIds(new Set())
      setPendingActionsCount((prev) => prev + 1)
      threadActionMutation.mutate(
        { ids: [threadId], action: 'delete' },
        { onSettled: () => setPendingActionsCount((prev) => Math.max(0, prev - 1)) }
      )
    }, [threadActionMutation])

    const handleToggleRead = useCallback((threadId: string, isUnread: boolean, e: React.MouseEvent) => {
      e.stopPropagation()
      setPendingActionsCount((prev) => prev + 1)
      threadActionMutation.mutate(
        { ids: [threadId], action: isUnread ? 'markRead' : 'markUnread' },
        { onSettled: () => setPendingActionsCount((prev) => Math.max(0, prev - 1)) }
      )
    }, [threadActionMutation])



    // ── Bulk actions ─────────────────────────────────────────────────────────

    const handleBulkAction = useCallback((action: string) => {
      const ids = Array.from(selectedThreadIds)
      if (ids.length === 0) return
      setSelectedThreadIds(new Set())
      setPendingActionsCount((prev) => prev + 1)
      threadActionMutation.mutate(
        { ids, action },
        { onSettled: () => setPendingActionsCount((prev) => Math.max(0, prev - 1)) }
      )
    }, [selectedThreadIds, threadActionMutation])



    // ── Imperative handle (for parent ref access) ────────────────────────────

    useImperativeHandle(ref, () => ({
      handleThreadAction: async (ids: string[], action: string) => {
        setSelectedThreadIds(new Set())
        setPendingActionsCount((prev) => prev + 1)
        try {
          await threadActionMutation.mutateAsync({ ids, action })
        } finally {
          setPendingActionsCount((prev) => Math.max(0, prev - 1))
        }
      },
    }), [threadActionMutation])

    // ── Prefetch handler ─────────────────────────────────────────────────────

    const handlePrefetch = useCallback((thread: EmailThread) => {
      if (!prefetchMessageConfig) return
      const config = prefetchMessageConfig(thread)
      if (!config) return
      queryClient.prefetchQuery({
        queryKey: config.queryKey,
        queryFn: async () => {
          const res = await fetch(config.url)
          if (!res.ok) throw new Error('Failed to prefetch messages')
          const data = await res.json()
          return data.messages ?? []
        },
        staleTime: 60_000,
      })
    }, [prefetchMessageConfig, queryClient])

    // ── Render ───────────────────────────────────────────────────────────────

    // Gmail not connected state
    if (!gmailConnected && !isLoading) {
      return (
        <div
          className={`flex flex-col h-full rounded-lg border overflow-hidden justify-center items-center py-16 px-4 text-center ${className ?? ''}`}
          style={{ borderColor: 'var(--color-surface-2)', background: 'var(--color-surface-0)' }}
        >
          <Mail size={24} style={{ color: 'var(--color-text-tertiary)', opacity: 0.4, marginBottom: 12 }} />
          <p className="text-[13px] font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            Gmail not connected
          </p>
        </div>
      )
    }

    return (
      <div
        className={`flex flex-col h-full rounded-lg border overflow-hidden ${className ?? ''}`}
        style={{ borderColor: 'var(--color-surface-2)', background: 'var(--color-surface-0)' }}
      >
        {/* ── Header row ─────────────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-4 py-2 border-b flex-shrink-0"
          style={{ borderColor: 'var(--color-surface-2)' }}
        >
          <div className="flex items-center gap-2">
            <Mail size={14} style={{ color: 'var(--color-accent)' }} />
            <span className="text-[13px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              {folder === 'inbox' ? 'Inbox' : folder === 'sent' ? 'Sent' : 'Archived'}
            </span>
            {!isLoading && (
              <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                {threads.length} thread{threads.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {renderHeaderActions?.()}
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: ['email-threads', apiBase, folder] })}
              className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-2)] transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
              title="Refresh"
            >
              <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
            </button>
            {renderHeaderRightActions?.()}
          </div>
        </div>

        {/* ── Bulk actions or folder tabs ─────────────────────────────────────── */}
        {showToolbar && hasSelection ? (
          <div
            className="flex items-center justify-between px-3 py-1.5 border-b flex-shrink-0 animate-tab-entrance"
            style={{ borderColor: 'var(--color-surface-2)', background: 'var(--color-accent-bg)' }}
          >
            <div className="flex items-center gap-2">
              <button
                onClick={clearSelection}
                className="h-6 w-6 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-2)] transition-colors"
                style={{ color: 'var(--color-accent)' }}
                title="Clear selection"
              >
                <X size={13} />
              </button>
              <span className="text-[12px] font-semibold" style={{ color: 'var(--color-accent)' }}>
                {selectedThreadIds.size} selected
              </span>
            </div>
            <div className="flex items-center gap-0.5">
              {folder === 'inbox' && (
                <ActionIconBtn icon={Archive} label="Archive selected" onClick={() => handleBulkAction('archive')} />
              )}
              <ActionIconBtn icon={Trash2} label="Delete selected" onClick={() => handleBulkAction('delete')} />
              <ActionIconBtn icon={MailOpen} label="Mark as read" onClick={() => handleBulkAction('markRead')} />
              <ActionIconBtn icon={Mail} label="Mark as unread" onClick={() => handleBulkAction('markUnread')} />
            </div>
          </div>
        ) : showToolbar ? (
          <div
            className="flex items-center justify-between px-3 py-1.5 border-b flex-shrink-0"
            style={{ borderColor: 'var(--color-surface-2)', background: 'var(--color-surface-1)' }}
          >
            {/* Select-all checkbox */}
            <button
              onClick={selectAllThreads}
              className="h-4 w-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors hover:border-[var(--color-text-tertiary)]"
              style={{ borderColor: 'var(--color-surface-3)', background: 'var(--color-surface-0)' }}
              title="Select all"
            >
              <Check size={9} style={{ color: 'var(--color-text-tertiary)', opacity: 0.7 }} />
            </button>

            {/* Folder tabs */}
            <div
              className="flex rounded-lg p-0.5 border"
              style={{ borderColor: 'var(--color-surface-3)', background: 'var(--color-surface-2)' }}
            >
              {(['inbox', 'sent', 'archived'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => {
                    setFolder(f)
                    setSelectedThreadIds(new Set())
                  }}
                  className={`px-2 py-0.5 text-[10px] font-medium rounded-md transition-colors ${
                    folder === f ? 'shadow-xs font-semibold' : 'hover:text-[var(--color-text-primary)]'
                  }`}
                  style={{
                    background: folder === f ? 'var(--color-surface-0)' : 'transparent',
                    color: folder === f ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  }}
                >
                  {f === 'inbox' ? 'Inbox' : f === 'sent' ? 'Sent' : 'Archived'}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* ── Thread list ─────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            // Skeleton rows
            <div>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b animate-pulse" style={{ borderColor: 'var(--color-surface-2)' }}>
                  <div className="h-4 w-4 rounded flex-shrink-0" style={{ background: 'var(--color-surface-2)' }} />
                  <div className="h-4 w-4 rounded flex-shrink-0" style={{ background: 'var(--color-surface-2)' }} />
                  <div className="h-9 w-9 rounded-full flex-shrink-0" style={{ background: 'var(--color-surface-2)' }} />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex justify-between">
                      <div className="h-3 w-28 rounded" style={{ background: 'var(--color-surface-2)' }} />
                      <div className="h-3 w-12 rounded" style={{ background: 'var(--color-surface-2)' }} />
                    </div>
                    <div className="h-3 w-full rounded" style={{ background: 'var(--color-surface-2)' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : threads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center h-full">
              <Mail size={28} style={{ color: 'var(--color-text-tertiary)', opacity: 0.4, marginBottom: 12 }} />
              <p className="text-[13px] font-medium" style={{ color: 'var(--color-text-primary)' }}>
                {folder === 'sent' ? 'No sent threads' : folder === 'archived' ? 'No archived threads' : 'No conversations yet'}
              </p>
              <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                {folder === 'inbox' && 'Send outreach emails to start tracking threads.'}
              </p>
            </div>
          ) : (
            threads.map((thread) => {
              const isChecked = selectedThreadIds.has(thread.threadId)
              const isStarred = starredThreadIds.has(thread.threadId)
              const isActive = selectedThreadId === thread.threadId

              return (
                <ThreadRow
                  key={thread.threadId}
                  thread={thread}
                  isChecked={isChecked}
                  isStarred={isStarred}
                  isActive={isActive}
                  hasSelection={hasSelection}
                  onToggleSelection={toggleThreadSelection}
                  onToggleStar={toggleStar}
                  onClick={onThreadClick}
                  onArchive={handleArchive}
                  onToggleRead={handleToggleRead}
                  onDelete={handleDelete}
                  renderMetaRow={renderMetaRow}
                  onMouseEnter={() => handlePrefetch(thread)}
                />
              )
            })
          )}
        </div>


      </div>
    )
  }
)

// ── Internal sub-components ───────────────────────────────────────────────────

function ActionIconBtn({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Archive
  label: string
  onClick: (e: React.MouseEvent) => void
}) {
  return (
    <button
      onClick={onClick}
      className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-2)] transition-colors"
      style={{ color: 'var(--color-text-secondary)' }}
      title={label}
    >
      <Icon size={15} />
    </button>
  )
}
