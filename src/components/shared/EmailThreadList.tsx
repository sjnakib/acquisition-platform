'use client'

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import {
  Mail, RefreshCw, Archive, Trash2,
  Clock, MailOpen, Check, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatEmailDate } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

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

function getSnoozePresets() {
  const now = new Date()

  const laterToday = new Date(now)
  laterToday.setHours(18, 0, 0, 0)
  if (laterToday.getTime() <= now.getTime()) laterToday.setHours(21, 0, 0, 0)

  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(8, 0, 0, 0)

  const nextWeek = new Date(now)
  const daysUntilMonday = (1 + 7 - now.getDay()) % 7 || 7
  nextWeek.setDate(nextWeek.getDate() + daysUntilMonday)
  nextWeek.setHours(8, 0, 0, 0)

  return [
    { label: 'Later today', value: laterToday.toISOString() },
    { label: 'Tomorrow morning', value: tomorrow.toISOString() },
    { label: 'Next week', value: nextWeek.toISOString() },
  ]
}

// ── Component Props ──────────────────────────────────────────────────────────

export interface EmailThreadListProps {
  /** Base URL for fetching threads (GET) and performing actions (PATCH). */
  apiBase: string
  /** Project ID for Gmail disconnect CTA link. */
  projectId: string
  /** Called when a thread row is clicked. */
  onThreadClick: (thread: EmailThread) => void
  /** Render extra content below the subject/snippet line (e.g. deal badge, portfolio indicator). */
  renderMetaRow?: (thread: EmailThread) => ReactNode
  /** Render extra actions in the header row (e.g. portfolio toggle, compose button). */
  renderHeaderActions?: () => ReactNode
  /** Show the select-all checkbox and folder tabs row. Default true. */
  showToolbar?: boolean
  /** Optional className for the root element. */
  className?: string
}

// ── Component ────────────────────────────────────────────────────────────────

export function EmailThreadList({
  apiBase,
  projectId,
  onThreadClick,
  renderMetaRow,
  renderHeaderActions,
  showToolbar = true,
  className,
}: EmailThreadListProps) {
  // Thread list state
  const [threads, setThreads] = useState<EmailThread[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [folder, setFolder] = useState<'inbox' | 'snoozed' | 'archived'>('inbox')
  const [gmailConnected, setGmailConnected] = useState(true)

  // Selection
  const [selectedThreadIds, setSelectedThreadIds] = useState<Set<string>>(new Set())

  // Snooze dialog
  const [snoozingThreadIds, setSnoozingThreadIds] = useState<string[] | null>(null)
  const [customSnoozeDate, setCustomSnoozeDate] = useState('')
  const [snoozing, setSnoozing] = useState(false)

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchThreads = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await fetch(`${apiBase}?folder=${folder}`)
      if (res.ok) {
        const data = await res.json()
        setThreads(data.threads ?? [])
        setGmailConnected(data.gmailConnected ?? true)
      } else if (res.status === 400) {
        const body = await res.json().catch(() => ({}))
        setGmailConnected(false)
        setThreads([])
        if (body.error && !silent) toast.error(body.error)
      }
    } catch {
      if (!silent) toast.error('Failed to load email threads')
    } finally {
      if (!silent) setLoading(false)
      else setRefreshing(false)
    }
  }, [apiBase, folder])

  useEffect(() => {
    fetchThreads()
  }, [fetchThreads])

  // ── Thread actions ─────────────────────────────────────────────────────────

  const handleThreadAction = useCallback(async (ids: string[], action: string) => {
    try {
      const res = await fetch(apiBase, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadIds: ids, action }),
      })
      if (res.ok) {
        setSelectedThreadIds(new Set())
        fetchThreads(true)
        const labels: Record<string, string> = {
          archive: 'Archived', delete: 'Deleted',
          markRead: 'Marked as read', markUnread: 'Marked as unread',
        }
        toast.success(labels[action] ?? 'Done')
      } else {
        const body = await res.json().catch(() => ({}))
        toast.error(body.error ?? 'Action failed')
      }
    } catch {
      toast.error('Action failed')
    }
  }, [apiBase, fetchThreads])

  const handleSnooze = useCallback(async (ids: string[], until: string) => {
    setSnoozing(true)
    try {
      const res = await fetch(apiBase, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadIds: ids, action: 'snooze', snoozedUntil: until }),
      })
      if (res.ok) {
        setSnoozingThreadIds(null)
        setCustomSnoozeDate('')
        setSelectedThreadIds(new Set())
        fetchThreads(true)
        toast.success('Snoozed')
      } else {
        const body = await res.json().catch(() => ({}))
        toast.error(body.error ?? 'Snooze failed')
      }
    } catch {
      toast.error('Snooze failed')
    } finally {
      setSnoozing(false)
    }
  }, [apiBase, fetchThreads])

  // ── Selection ──────────────────────────────────────────────────────────────

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

  // ── Render ─────────────────────────────────────────────────────────────────

  // Gmail not connected state
  if (!gmailConnected && !loading) {
    return (
      <div className={`flex flex-col items-center justify-center py-16 px-4 text-center ${className ?? ''}`}>
        <Mail size={32} style={{ color: 'var(--color-text-tertiary)', opacity: 0.4, marginBottom: 16 }} />
        <p className="text-[14px] font-medium" style={{ color: 'var(--color-text-primary)' }}>
          Gmail not connected
        </p>
        <p className="text-[12px] mt-1 mb-4" style={{ color: 'var(--color-text-tertiary)' }}>
          Connect a Gmail account in project settings to track email threads.
        </p>
        <a
          href={`/projects/${projectId}/settings`}
          className="inline-flex h-8 px-4 rounded-md text-[12px] font-medium transition-colors items-center no-underline"
          style={{ background: 'var(--color-accent)', color: 'var(--color-text-inverse)' }}
        >
          Connect Gmail
        </a>
      </div>
    )
  }

  return (
    <div className={`flex flex-col h-full rounded-lg border overflow-hidden ${className ?? ''}`}
      style={{ borderColor: 'var(--color-surface-2)', background: 'var(--color-surface-0)' }}
    >
      {/* Header row */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b flex-shrink-0"
        style={{ borderColor: 'var(--color-surface-2)' }}
      >
        <div className="flex items-center gap-2">
          <Mail size={15} style={{ color: 'var(--color-accent)' }} />
          <span className="text-[13px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {folder === 'inbox' ? 'Inbox' : folder === 'snoozed' ? 'Snoozed' : 'Archived'}
          </span>
          {!loading && (
            <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
              {threads.length} thread{threads.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {renderHeaderActions?.()}
          <button
            onClick={() => fetchThreads(true)}
            className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-[var(--color-surface-2)] transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
            title="Refresh"
          >
            <RefreshCw size={13} className={loading || refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Bulk actions or folder tabs */}
      {showToolbar && selectedThreadIds.size > 0 ? (
        <div
          className="flex items-center justify-between px-4 py-2 border-b flex-shrink-0 animate-tab-entrance"
          style={{ borderColor: 'var(--color-surface-2)', background: 'var(--color-accent-bg)' }}
        >
          <div className="flex items-center gap-2">
            <button
              onClick={clearSelection}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-[var(--color-surface-3)] transition-colors"
              style={{ color: 'var(--color-accent)' }}
              title="Clear selection"
            >
              <X size={14} />
            </button>
            <span className="text-[12px] font-semibold" style={{ color: 'var(--color-accent)' }}>
              {selectedThreadIds.size} selected
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {folder === 'inbox' && (
              <ActionBtn icon={Archive} label="Archive selected" onClick={() => handleThreadAction(Array.from(selectedThreadIds), 'archive')} />
            )}
            <ActionBtn icon={Trash2} label="Delete selected" onClick={() => handleThreadAction(Array.from(selectedThreadIds), 'delete')} />
            <ActionBtn icon={MailOpen} label="Mark selected as read" onClick={() => handleThreadAction(Array.from(selectedThreadIds), 'markRead')} />
            <ActionBtn icon={Mail} label="Mark selected as unread" onClick={() => handleThreadAction(Array.from(selectedThreadIds), 'markUnread')} />
            <ActionBtn icon={Clock} label="Snooze selected" onClick={() => setSnoozingThreadIds(Array.from(selectedThreadIds))} />
          </div>
        </div>
      ) : showToolbar ? (
        <div
          className="flex items-center justify-between px-4 py-2 border-b flex-shrink-0"
          style={{ borderColor: 'var(--color-surface-2)', background: 'var(--color-surface-1)' }}
        >
          <button
            onClick={selectAllThreads}
            className="h-5 w-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors hover:border-[var(--color-text-tertiary)]"
            style={{ borderColor: 'var(--color-surface-3)', background: 'var(--color-surface-0)' }}
            title="Select all"
          >
            <Check size={10} style={{ color: 'var(--color-text-tertiary)', opacity: 0.6 }} />
          </button>

          <div
            className="flex rounded-lg p-0.5 border"
            style={{ borderColor: 'var(--color-surface-3)', background: 'var(--color-surface-2)' }}
          >
            {(['inbox', 'snoozed', 'archived'] as const).map((f) => (
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
                {f === 'inbox' ? 'Inbox' : f === 'snoozed' ? 'Snoozed' : 'Archived'}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Thread list */}
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
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center h-full">
            <Mail size={28} style={{ color: 'var(--color-text-tertiary)', opacity: 0.4, marginBottom: 12 }} />
            <p className="text-[13px] font-medium" style={{ color: 'var(--color-text-primary)' }}>
              {folder === 'snoozed' ? 'No snoozed threads' : folder === 'archived' ? 'No archived threads' : 'No conversations yet'}
            </p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
              {folder === 'inbox' && 'Send outreach emails to start tracking threads.'}
            </p>
          </div>
        ) : (
          threads.map((thread) => {
            const isChecked = selectedThreadIds.has(thread.threadId)
            return (
              <div
                key={thread.threadId}
                className="group flex items-start gap-2 px-3 py-3 border-b transition-colors hover:bg-[var(--color-surface-1)] relative"
                style={{ borderColor: 'var(--color-surface-2)' }}
              >
                {/* Checkbox */}
                <button
                  onClick={(e) => { e.stopPropagation(); toggleThreadSelection(thread.threadId) }}
                  className="h-5 w-5 rounded border flex items-center justify-center flex-shrink-0 mt-1 transition-colors hover:border-[var(--color-text-tertiary)]"
                  style={{
                    borderColor: isChecked ? 'var(--color-accent)' : 'var(--color-surface-3)',
                    background: isChecked ? 'var(--color-accent-bg)' : 'var(--color-surface-0)',
                  }}
                >
                  {isChecked && <Check size={10} style={{ color: 'var(--color-accent)' }} />}
                </button>

                {/* Content */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onThreadClick(thread)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onThreadClick(thread)
                    }
                  }}
                  className="flex-1 flex items-start gap-3 min-w-0 text-left cursor-pointer outline-none"
                >
                  {/* Avatar */}
                  <div
                    className="h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold"
                    style={{
                      background: thread.isUnread ? 'var(--color-accent)' : threadAvatarColor(thread.contactName),
                      color: 'var(--color-text-inverse)',
                    }}
                  >
                    {threadInitials(thread.contactName)}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Name + date */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[13px] truncate ${thread.isUnread ? 'font-bold' : 'font-normal'}`}
                        style={{ color: thread.isUnread ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}
                      >
                        {thread.contactName ?? thread.contactEmail ?? 'Unknown'}
                      </span>
                      <span
                        className="text-[11px] flex-shrink-0 ml-2 group-hover:opacity-0 transition-opacity"
                        style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-jetbrains-mono)' }}
                      >
                        {formatEmailDate(thread.lastDate)}
                      </span>
                    </div>

                    {/* Subject + snippet */}
                    <p className="text-[12px] truncate mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                      <span className={thread.isUnread ? 'font-bold text-[var(--color-text-primary)]' : 'font-normal text-[var(--color-text-secondary)]'}>
                        {thread.subject ?? '(no subject)'}
                      </span>
                      {thread.snippet && (
                        <span className="font-normal" style={{ color: 'var(--color-text-tertiary)' }}>
                          {' — '}{thread.snippet}
                        </span>
                      )}
                    </p>

                    {/* Meta row: consumer slot + built-in badges */}
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {renderMetaRow?.(thread)}
                      {thread.status === 'replied' && (
                        <span className="text-[10px] font-medium" style={{ color: 'var(--color-success-text)' }}>Replied</span>
                      )}
                      {thread.isUnread && (
                        <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: 'var(--color-accent)' }} />
                      )}
                      {thread.snoozedUntil && (
                        <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                          <Clock size={10} /> Snoozed
                        </span>
                      )}
                      {thread.messageCount > 1 && (
                        <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                          {thread.messageCount} msgs
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Hover actions */}
                <div className="absolute right-3 top-3 hidden group-hover:flex items-center gap-1 bg-[var(--color-surface-1)] pl-2 rounded">
                  {thread.isInbox && (
                    <ActionBtn icon={Archive} label="Archive" onClick={(e) => { e.stopPropagation(); handleThreadAction([thread.threadId], 'archive') }} />
                  )}
                  <ActionBtn icon={Trash2} label="Delete" onClick={(e) => { e.stopPropagation(); handleThreadAction([thread.threadId], 'delete') }} />
                  <ActionBtn
                    icon={thread.isUnread ? MailOpen : Mail}
                    label={thread.isUnread ? 'Mark as read' : 'Mark as unread'}
                    onClick={(e) => { e.stopPropagation(); handleThreadAction([thread.threadId], thread.isUnread ? 'markRead' : 'markUnread') }}
                  />
                  <ActionBtn icon={Clock} label="Snooze" onClick={(e) => { e.stopPropagation(); setSnoozingThreadIds([thread.threadId]) }} />
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Snooze dialog */}
      <Dialog open={snoozingThreadIds !== null} onOpenChange={(open) => { if (!open) { setSnoozingThreadIds(null); setCustomSnoozeDate('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Snooze thread{snoozingThreadIds && snoozingThreadIds.length > 1 ? 's' : ''}</DialogTitle>
            <DialogDescription>
              Thread{snoozingThreadIds && snoozingThreadIds.length > 1 ? 's' : ''} will return to inbox at the selected time.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-2">
            {getSnoozePresets().map((preset) => (
              <button
                key={preset.value}
                onClick={() => snoozingThreadIds && handleSnooze(snoozingThreadIds, preset.value)}
                disabled={snoozing}
                className="w-full text-left px-4 py-3 rounded-lg border transition-colors hover:bg-[var(--color-surface-1)] text-[13px] font-medium"
                style={{ borderColor: 'var(--color-surface-2)', color: 'var(--color-text-primary)' }}
              >
                {preset.label}
              </button>
            ))}
            <div className="border-t pt-3 mt-1" style={{ borderColor: 'var(--color-surface-2)' }}>
              <label className="text-[11px] font-medium block mb-1.5" style={{ color: 'var(--color-text-tertiary)' }}>
                Custom date & time
              </label>
              <input
                type="datetime-local"
                value={customSnoozeDate}
                onChange={(e) => setCustomSnoozeDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-[12px] outline-none"
                style={{
                  borderColor: 'var(--color-surface-3)',
                  background: 'var(--color-surface-0)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => { setSnoozingThreadIds(null); setCustomSnoozeDate('') }}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={snoozing || !customSnoozeDate}
              onClick={() => snoozingThreadIds && customSnoozeDate && handleSnooze(snoozingThreadIds, new Date(customSnoozeDate).toISOString())}
            >
              {snoozing ? 'Snoozing...' : 'Snooze'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Internal sub-component ───────────────────────────────────────────────────

function ActionBtn({
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
      className="h-7 w-7 flex items-center justify-center rounded hover:bg-[var(--color-surface-2)] transition-colors"
      style={{ color: 'var(--color-text-secondary)' }}
      title={label}
    >
      <Icon size={14} />
    </button>
  )
}
