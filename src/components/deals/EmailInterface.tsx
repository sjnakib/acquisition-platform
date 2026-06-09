'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import {
  Mail, Reply, RefreshCw, FolderKanban,
  ChevronDown, ChevronUp, ExternalLink, X,
  Minimize2, Maximize2, Edit, Trash2, Check,
  Clock, Archive, MailOpen, Forward, Paperclip,
  MoreVertical,
} from 'lucide-react'
import { toast } from 'sonner'
import { ContactsPanel } from './ContactsPanel'
import { EmailComposer, type ComposeSendData, type EmailComposerHandle, type AttachmentFile } from '@/components/shared/EmailComposer'
import { formatEmailDate, formatEmailFullDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// ── Types ────────────────────────────────────────────────────────────────────

interface Thread {
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

interface Message {
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(str: string | null): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

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
  if (match) {
    return (match[1] || match[2] || '').trim()
  }
  if (from.includes('@')) {
    return from.split('@')[0] || from
  }
  return from
}

function parseSenderEmail(from: string): string {
  const match = from.match(/<([^>]+)>/)
  if (match) {
    return match[1] || from
  }
  return from
}

function renderAttachmentName(filename: string): React.ReactNode {
  const idx = filename.lastIndexOf('.')
  if (idx === -1) {
    return <span className="truncate max-w-[120px]">{filename}</span>
  }
  const name = filename.slice(0, idx)
  const ext = filename.slice(idx)
  return (
    <span className="inline-flex min-w-0 max-w-[180px]">
      <span className="truncate flex-shrink min-w-[20px]">{name}</span>
      <span className="flex-shrink-0">{ext}</span>
    </span>
  )
}

function getSnoozePresets() {
  const now = new Date()
  
  const laterToday = new Date(now)
  laterToday.setHours(18, 0, 0, 0)
  if (laterToday.getTime() <= now.getTime()) {
    laterToday.setHours(21, 0, 0, 0)
  }

  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(8, 0, 0, 0)

  const nextWeek = new Date(now)
  const daysUntilMonday = (1 + 7 - now.getDay()) % 7 || 7
  nextWeek.setDate(nextWeek.getDate() + daysUntilMonday)
  nextWeek.setHours(8, 0, 0, 0)

  return [
    { label: 'Later today', value: laterToday.toISOString(), timeLabel: '6:00 PM' },
    { label: 'Tomorrow morning', value: tomorrow.toISOString(), timeLabel: '8:00 AM' },
    { label: 'Next week', value: nextWeek.toISOString(), timeLabel: 'Mon 8:00 AM' },
  ]
}

// ── Component ────────────────────────────────────────────────────────────────

export function EmailInterface({ dealId, projectId }: { dealId: string; dealName: string | null; projectId?: string }) {
  // Thread list
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)
  const [includePortfolio, setIncludePortfolio] = useState(false)
  const [gmailConnected, setGmailConnected] = useState(true)
  const [folder, setFolder] = useState<'inbox' | 'snoozed' | 'archived'>('inbox')

  // Selected thread
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set())

  // Active dropdown menu for individual messages
  const [activeMenuMsgId, setActiveMenuMsgId] = useState<string | null>(null)

  // Delete message confirmation
  const [deleteMsgId, setDeleteMsgId] = useState<string | null>(null)
  const [deleteMsgThreadId, setDeleteMsgThreadId] = useState<string | null>(null)

  // Compose popup & drafts
  const [composeOpen, setComposeOpen] = useState(false)
  const [composeMinimized, setComposeMinimized] = useState(false)
  const [composeMode, setComposeMode] = useState<'new' | 'reply' | 'forward' | null>(null)
  const [composerDefaults, setComposerDefaults] = useState<{ to?: string; subject?: string }>({})
  const [draftBody, setDraftBody] = useState('')
  const [draftCc, setDraftCc] = useState('')
  const [sending, setSending] = useState(false)

  // Selection
  const [selectedThreadIds, setSelectedThreadIds] = useState<Set<string>>(new Set())
  const [snoozingThreadIds, setSnoozingThreadIds] = useState<string[] | null>(null)
  const [customSnoozeDate, setCustomSnoozeDate] = useState('')

  // Attachments
  const [attachments, setAttachments] = useState<AttachmentFile[]>([])

  const emailComposerRef = useRef<EmailComposerHandle>(null)

  // Refs to maintain stable references for callbacks and satisfy React Compiler
  const threadsRef = useRef(threads)
  const messagesRef = useRef(messages)
  const selectedThreadRef = useRef(selectedThread)

  const includePortfolioRef = useRef(includePortfolio)
  useEffect(() => { includePortfolioRef.current = includePortfolio }, [includePortfolio])
  useEffect(() => { threadsRef.current = threads }, [threads])
  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { selectedThreadRef.current = selectedThread }, [selectedThread])

  // ── Data fetching ────────────────────────────────────────────────────────

  const refreshMessages = useCallback(async (threadId: string) => {
    try {
      const res = await fetch(`/api/deals/${dealId}/emails/threads?threadId=${threadId}&dealId=${dealId}`)
      if (res.ok) {
        const data = await res.json()
        const msgs: Message[] = data.messages ?? []
        setMessages(msgs)
        // Auto-expand new messages if they aren't already
        setExpandedMessages((prev) => {
          const next = new Set(prev)
          for (const m of msgs) {
            if (!messagesRef.current.some((oldMsg) => oldMsg.id === m.id)) {
              next.add(m.id)
            }
          }
          return next
        })
      }
    } catch (err) {
      console.error('[EmailInterface] Silent message refresh failed:', err)
    }
  }, [dealId])

  const fetchThreads = useCallback(async (portfolio: boolean, silent = false) => {
    if (!silent) setLoading(true)
    try {
      const url = `/api/deals/${dealId}/emails?folder=${folder}${portfolio ? '&portfolio=true' : ''}`
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        const updatedThreads = data.threads ?? []
        setThreads(updatedThreads)
        setGmailConnected(data.gmailConnected ?? true)

        // If there's an open thread, check if we need to refresh its messages
        if (selectedThreadRef.current) {
          const currentThreadId = selectedThreadRef.current.threadId
          const updatedThread = updatedThreads.find((t: Thread) => t.threadId === currentThreadId)

          if (!updatedThread) {
            // Thread is no longer in this folder view
            setSelectedThread(null)
            setMessages([])
          } else {
            const currentThread = selectedThreadRef.current
            if (
              updatedThread.messageCount !== currentThread.messageCount ||
              updatedThread.lastDate !== currentThread.lastDate ||
              updatedThread.isUnread !== currentThread.isUnread
            ) {
              // Update selected thread state with new metadata
              setSelectedThread(updatedThread)
              // Refresh messages silently
              refreshMessages(currentThreadId)
            }
          }
        }
      } else if (!silent) {
        const json = await res.json()
        toast.error(json.error ?? 'Failed to load emails')
      }
    } catch {
      if (!silent) toast.error('Failed to load emails')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [dealId, folder, refreshMessages])

  useEffect(() => {
    const doFetch = () => fetchThreads(includePortfolio)
    if (window.requestIdleCallback) {
      const id = window.requestIdleCallback(doFetch)
      return () => window.cancelIdleCallback(id)
    } else {
      const id = setTimeout(doFetch, 0)
      return () => clearTimeout(id)
    }
  }, [includePortfolio, folder, fetchThreads])

  // Realtime subscription for live updates (like websockets)
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`email-inbox-live-${dealId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'email_outreach' },
        (payload) => {
          const dealIdFromPayload = payload.new ? (payload.new as { deal_id?: string }).deal_id : null
          if (!dealIdFromPayload || dealIdFromPayload === dealId || includePortfolioRef.current) {
            fetchThreads(includePortfolioRef.current, true)
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'snoozed_threads' },
        (payload) => {
          const dealIdFromPayload = payload.new ? (payload.new as { deal_id?: string }).deal_id : null
          if (!dealIdFromPayload || dealIdFromPayload === dealId || includePortfolioRef.current) {
            fetchThreads(includePortfolioRef.current, true)
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'google_connections' },
        () => {
          // Any update to google connections might mean a new email received/sent
          fetchThreads(includePortfolioRef.current, true)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [dealId, fetchThreads])

  // Smart polling and tab focus/visibility synchronization fallback
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchThreads(includePortfolioRef.current, true)
      }
    }, 10000) // Poll every 10 seconds

    const handleSync = () => {
      if (document.visibilityState === 'visible') {
        fetchThreads(includePortfolioRef.current, true)
      }
    }

    window.addEventListener('focus', handleSync)
    document.addEventListener('visibilitychange', handleSync)

    return () => {
      clearInterval(intervalId)
      window.removeEventListener('focus', handleSync)
      document.removeEventListener('visibilitychange', handleSync)
    }
  }, [fetchThreads])

  const toggleMessageExpand = useCallback((msgId: string) => {
    setExpandedMessages((prev) => {
      const next = new Set(prev)
      if (next.has(msgId)) next.delete(msgId)
      else next.add(msgId)
      return next
    })
  }, [])

  const expandAllMessages = useCallback(() => {
    setExpandedMessages(new Set(messages.map((m) => m.id)))
  }, [messages])

  const collapseAllMessages = useCallback(() => {
    setExpandedMessages(new Set())
  }, [])

  // ── Helper to execute PATCH action in the background ──
  const executeAction = useCallback(async (threadIds: string[], action: string, snoozedUntil?: string) => {
    try {
      const res = await fetch(`/api/deals/${dealId}/emails/threads`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadIds,
          action,
          snoozedUntil,
        }),
      })
      if (!res.ok) {
        const json = await res.json()
        toast.error(json.error ?? 'Failed to apply action')
        return false
      }
      return true
    } catch {
      toast.error('Network error occurred')
      return false
    }
  }, [dealId])

  // ── Thread action handler with Optimistic Updates & Undo ──
  const handleThreadAction = useCallback(async (
    threadIds: string[],
    action: string,
    snoozedUntil?: string,
    isUndoAction = false
  ) => {
    // 1. Capture current state for potential rollback
    const originalThreads = [...threadsRef.current]
    const originalSelectedThread = selectedThreadRef.current
    const originalMessages = [...messagesRef.current]

    // 2. Perform optimistic update on the local state
    let actionLabel = ''
    switch (action) {
      case 'archive':
        actionLabel = threadIds.length === 1 ? 'Conversation archived' : `${threadIds.length} conversations archived`
        setThreads((prev) => prev.filter((t) => !threadIds.includes(t.threadId)))
        if (selectedThreadRef.current && threadIds.includes(selectedThreadRef.current.threadId)) {
          setSelectedThread(null)
          setMessages([])
        }
        break
      case 'delete':
        actionLabel = threadIds.length === 1 ? 'Conversation moved to Trash' : `${threadIds.length} conversations moved to Trash`
        setThreads((prev) => prev.filter((t) => !threadIds.includes(t.threadId)))
        if (selectedThreadRef.current && threadIds.includes(selectedThreadRef.current.threadId)) {
          setSelectedThread(null)
          setMessages([])
        }
        break
      case 'snooze':
        actionLabel = threadIds.length === 1 ? 'Conversation snoozed' : `${threadIds.length} conversations snoozed`
        setThreads((prev) => prev.filter((t) => !threadIds.includes(t.threadId)))
        if (selectedThreadRef.current && threadIds.includes(selectedThreadRef.current.threadId)) {
          setSelectedThread(null)
          setMessages([])
        }
        break
      case 'markRead':
        actionLabel = threadIds.length === 1 ? 'Marked as read' : `${threadIds.length} marked as read`
        setThreads((prev) => prev.map((t) => threadIds.includes(t.threadId) ? { ...t, isUnread: false } : t))
        if (selectedThreadRef.current && threadIds.includes(selectedThreadRef.current.threadId)) {
          setSelectedThread((prev) => prev ? { ...prev, isUnread: false } : null)
          setMessages((prev) =>
            prev.map((msg) => ({
              ...msg,
              labelIds: msg.labelIds.filter((l) => l !== 'UNREAD')
            }))
          )
        }
        break
      case 'markUnread':
        actionLabel = threadIds.length === 1 ? 'Marked as unread' : `${threadIds.length} marked as unread`
        setThreads((prev) => prev.map((t) => threadIds.includes(t.threadId) ? { ...t, isUnread: true } : t))
        if (selectedThreadRef.current && threadIds.includes(selectedThreadRef.current.threadId)) {
          setSelectedThread((prev) => prev ? { ...prev, isUnread: true } : null)
          setMessages((prev) => {
            if (prev.length === 0) return prev
            return prev.map((msg, idx) => {
              if (idx === prev.length - 1) {
                if (!msg.labelIds.includes('UNREAD')) {
                  return { ...msg, labelIds: [...msg.labelIds, 'UNREAD'] }
                }
              }
              return msg
            })
          })
        }
        break
      case 'unarchive':
        actionLabel = threadIds.length === 1 ? 'Conversation moved to Inbox' : `${threadIds.length} conversations moved to Inbox`
        break
      case 'untrash':
        actionLabel = threadIds.length === 1 ? 'Conversation restored' : `${threadIds.length} conversations restored`
        break
      case 'unsnooze':
        actionLabel = threadIds.length === 1 ? 'Conversation unsnoozed' : `${threadIds.length} conversations unsnoozed`
        break
    }

    // 3. Trigger optimistic toast with Undo action (unless this is already an undo action)
    if (!isUndoAction) {
      toast.success(actionLabel, {
        action: {
          label: 'Undo',
          onClick: () => {
            // Determine reverse action
            let undoAction = ''
            switch (action) {
              case 'archive': undoAction = 'unarchive'; break
              case 'delete': undoAction = 'untrash'; break
              case 'snooze': undoAction = 'unsnooze'; break
              case 'markRead': undoAction = 'markUnread'; break
              case 'markUnread': undoAction = 'markRead'; break
            }
            if (undoAction) {
              // Revert optimistic state locally immediately for snappy feel
              setThreads(originalThreads)
              setSelectedThread(originalSelectedThread)
              setMessages(originalMessages)
              // Trigger undo PATCH in background
              executeAction(threadIds, undoAction)
            }
          }
        }
      })
    } else {
      toast.success(actionLabel)
    }

    // 4. Perform the background API call
    const success = await executeAction(threadIds, action, snoozedUntil)
    if (!success) {
      // Rollback on failure
      setThreads(originalThreads)
      setSelectedThread(originalSelectedThread)
      setMessages(originalMessages)
    }
  }, [executeAction])

  const openThread = useCallback(async (thread: Thread) => {
    setSelectedThread(thread)
    setMessagesLoading(true)
    setExpandedMessages(new Set())
    if (thread.isUnread) {
      handleThreadAction([thread.threadId], 'markRead')
    }
    try {
      const res = await fetch(`/api/deals/${dealId}/emails/threads?threadId=${thread.threadId}&dealId=${dealId}`)
      if (res.ok) {
        const data = await res.json()
        let msgs: Message[] = data.messages ?? []
        if (thread.isUnread) {
          msgs = msgs.map((m) => ({
            ...m,
            labelIds: m.labelIds.filter((l) => l !== 'UNREAD'),
          }))
        }
        setMessages(msgs)
        if (msgs.length > 0) {
          setExpandedMessages(new Set([msgs[msgs.length - 1]!.id]))
        }
      } else {
        const json = await res.json()
        toast.error(json.error ?? 'Failed to load thread')
        setMessages([])
      }
    } catch {
      toast.error('Failed to load thread')
      setMessages([])
    } finally {
      setMessagesLoading(false)
    }
  }, [dealId, handleThreadAction])

  const handleUndoDeleteMessage = useCallback(async (
    messageId: string,
    threadId: string,
    originalMessages: Message[]
  ) => {
    setMessages(originalMessages)
    try {
      const res = await fetch(`/api/deals/${dealId}/emails/threads`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId,
          messageId,
          action: 'untrashMessage',
        }),
      })
      if (!res.ok) {
        const json = await res.json()
        toast.error(json.error ?? 'Failed to restore message')
        setMessages((prev) => prev.filter((m) => m.id !== messageId))
      } else {
        toast.success('Message restored')
      }
    } catch {
      toast.error('Failed to restore message')
      setMessages((prev) => prev.filter((m) => m.id !== messageId))
    }
  }, [dealId])

  const handleDeleteMessage = useCallback(async (messageId: string, threadId: string) => {
    const originalMessages = [...messagesRef.current]
    setMessages((prev) => prev.filter((m) => m.id !== messageId))

    toast.success('Message deleted', {
      action: {
        label: 'Undo',
        onClick: () => handleUndoDeleteMessage(messageId, threadId, originalMessages),
      },
    })

    try {
      const res = await fetch(`/api/deals/${dealId}/emails/threads`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId,
          messageId,
          action: 'deleteMessage',
        }),
      })
      if (!res.ok) {
        const json = await res.json()
        toast.error(json.error ?? 'Failed to delete message')
        setMessages(originalMessages)
      }
    } catch {
      toast.error('Failed to delete message')
      setMessages(originalMessages)
    }
  }, [dealId, handleUndoDeleteMessage])

  // ── Compose actions ──────────────────────────────────────────────────────

  const openCompose = useCallback(() => {
    setComposeOpen(true)
    setComposeMinimized(false)
    setComposeMode('new')
    setComposerDefaults({})
    setDraftBody('')
    setDraftCc('')
    setAttachments([])
    emailComposerRef.current?.clear()
  }, [])

  const popOutReply = useCallback(() => {
    if (!emailComposerRef.current) return
    const draft = emailComposerRef.current.getDraftData()
    setComposerDefaults({
      to: draft.to,
      subject: draft.subject,
    })
    setDraftBody(draft.htmlBody)
    setDraftCc(draft.cc)
    setComposeOpen(true) // Open floating compose
  }, [])

  const handleContactEmailClick = useCallback((email: string, contactId: string) => {
    if (contactId) {
      // satisfy eslint
    }
    setComposerDefaults({ to: email })
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

  // ── Selection ──────────────────────────────────────────────────────────

  const toggleThreadSelection = useCallback((threadId: string) => {
    setSelectedThreadIds((prev) => {
      const next = new Set(prev)
      if (next.has(threadId)) next.delete(threadId)
      else next.add(threadId)
      return next
    })
  }, [])

  const selectAllThreads = useCallback(() => {
    const deletableIds = threads.map((t) => t.threadId)
    setSelectedThreadIds(new Set(deletableIds))
  }, [threads])

  const clearSelection = useCallback(() => {
    setSelectedThreadIds(new Set())
  }, [])

  // ── Attachments ────────────────────────────────────────────────────────

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
            id: data.id,
            filename: data.filename,
            size_bytes: data.size_bytes,
            mime_type: data.mime_type,
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
      const lastMsg = composeMode === 'reply' && messages.length > 0 ? messages[messages.length - 1]! : null
      const res = await fetch(`/api/deals/${dealId}/emails/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: data.to,
          subject: data.subject,
          htmlBody: data.htmlBody,
          contact_id: data.contactId || undefined,
          cc: data.cc || undefined,
          bcc: data.bcc || undefined,
          scheduledAt: data.scheduledAt || undefined,
          threadId: composeMode === 'reply' && selectedThread ? selectedThread.threadId : undefined,
          inReplyTo: composeMode === 'reply' && lastMsg ? lastMsg.id : undefined,
          attachment_ids: attachments.map((a) => a.id),
        }),
      })
      if (res.ok) {
        if (data.scheduledAt) {
          const formattedDate = new Date(data.scheduledAt).toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
          })
          toast.success(`Email scheduled for ${formattedDate}`)
        } else {
          toast.success('Email sent')
        }
        dismissCompose()
        fetchThreads(includePortfolio)
        if (selectedThread) {
          openThread(selectedThread)
        }
      } else {
        const json = await res.json()
        toast.error(json.error ?? 'Failed to send')
      }
    } catch {
      toast.error('Failed to send email')
    } finally {
      setSending(false)
    }
  }, [composeMode, selectedThread, messages, dealId, fetchThreads, includePortfolio, dismissCompose, attachments, openThread])

  // ── Settings URL ─────────────────────────────────────────────────────────

  const settingsUrl = projectId
    ? `/projects/${projectId}/settings`
    : '/settings'

  // ── Derived state ────────────────────────────────────────────────────────

  const allExpanded = messages.length > 0 && expandedMessages.size === messages.length
  const expandedCount = expandedMessages.size

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Snooze Presets Modal/Popover */}
      {snoozingThreadIds && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
          <div className="w-80 rounded-xl border p-4 shadow-xl flex flex-col gap-3" style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-surface-2)' }}>
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--color-surface-2)' }}>
              <span className="text-[13px] font-semibold flex items-center gap-1.5" style={{ color: 'var(--color-text-primary)' }}>
                <Clock size={14} />
                Snooze {snoozingThreadIds.length === 1 ? 'conversation' : `${snoozingThreadIds.length} conversations`}
              </span>
              <button
                onClick={() => { setSnoozingThreadIds(null); setCustomSnoozeDate('') }}
                className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Presets */}
            <div className="flex flex-col gap-1">
              {getSnoozePresets().map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => {
                    handleThreadAction(snoozingThreadIds, 'snooze', preset.value)
                    setSnoozingThreadIds(null)
                  }}
                  className="w-full text-left px-3 py-2 text-[12px] rounded-lg hover:bg-[var(--color-surface-1)] transition-colors flex justify-between items-center"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  <span>{preset.label}</span>
                  <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-jetbrains-mono)' }}>{preset.timeLabel}</span>
                </button>
              ))}
            </div>

            {/* Custom Date Time */}
            <div className="border-t pt-3 flex flex-col gap-2" style={{ borderColor: 'var(--color-surface-2)' }}>
              <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                Custom date & time
              </span>
              <Input
                type="datetime-local"
                value={customSnoozeDate}
                onChange={(e) => setCustomSnoozeDate(e.target.value)}
                className="w-full h-8 px-2 border rounded-md text-[12px] bg-[var(--color-surface-0)]"
                style={{
                  borderColor: 'var(--color-surface-3)',
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-jetbrains-mono)',
                }}
              />
              <Button
                size="sm"
                disabled={!customSnoozeDate}
                onClick={() => {
                  if (customSnoozeDate) {
                    const isoDate = new Date(customSnoozeDate).toISOString()
                    handleThreadAction(snoozingThreadIds, 'snooze', isoDate)
                    setSnoozingThreadIds(null)
                    setCustomSnoozeDate('')
                  }
                }}
                className="w-full h-7 text-[11px] font-medium mt-1"
                style={{ background: 'var(--color-accent)', color: 'var(--color-text-inverse)' }}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Gmail not connected warning */}
      {!gmailConnected && !loading && (
        <div
          className="flex items-center justify-between gap-4 rounded-md p-3 text-sm mb-4"
          style={{
            background: 'var(--color-warning-bg)',
            border: '1px solid var(--color-warning-border)',
            color: 'var(--color-warning-text)',
          }}
        >
          <span className="min-w-0">
            Gmail account not connected — required for sending and receiving emails for this project.
          </span>
          <Button asChild size="sm" className="flex-shrink-0">
            <a href={settingsUrl}>Connect Gmail Account</a>
          </Button>
        </div>
      )}

      <div className="flex flex-1 min-h-0 border rounded-xl overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
      {/* ═══ Thread List (left) ══════════════════════════════════════════════ */}
      <div
        className="w-[360px] flex-shrink-0 flex flex-col border-r"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-0)' }}
      >
        {/* Header (First Row) — Always Visible */}
        <div
          className="flex items-center justify-between px-4 h-[53px] border-b flex-shrink-0"
          style={{ borderColor: 'var(--color-surface-2)' }}
        >
          <div className="flex items-center gap-2">
            <h4 className="text-[13px] font-semibold" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans)' }}>
              Emails
            </h4>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setIncludePortfolio(!includePortfolio)
                setSelectedThread(null)
                setMessages([])
              }}
              className="flex items-center gap-1.5 h-6 px-2 rounded text-[10px] font-medium transition-colors"
              style={{
                background: includePortfolio ? 'var(--color-accent-bg)' : 'transparent',
                color: includePortfolio ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
              }}
              title="Include portfolio emails"
            >
              <FolderKanban size={11} />
              Portfolio
            </button>
            <button
              onClick={() => fetchThreads(includePortfolio)}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-[var(--color-surface-2)] transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
              title="Refresh"
            >
              <RefreshCw size={12} />
            </button>
            <button
              onClick={openCompose}
              className="h-7 px-3 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1"
              style={{ background: 'var(--color-accent)', color: 'var(--color-text-inverse)' }}
            >
              <Edit size={11} />
              Compose
            </button>
          </div>
        </div>

        {/* Action / Folders Row (Second Row) */}
        {selectedThreadIds.size > 0 ? (
          /* ── Bulk Actions Toolbar ── */
          <div
            className="flex items-center justify-between px-4 py-2 border-b animate-tab-entrance"
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
                <button
                  onClick={() => handleThreadAction(Array.from(selectedThreadIds), 'archive')}
                  className="h-7 w-7 flex items-center justify-center rounded hover:bg-[var(--color-surface-3)] transition-colors"
                  style={{ color: 'var(--color-text-secondary)' }}
                  title="Archive selected"
                >
                  <Archive size={14} />
                </button>
              )}
              <button
                onClick={() => handleThreadAction(Array.from(selectedThreadIds), 'delete')}
                className="h-7 w-7 flex items-center justify-center rounded hover:bg-[var(--color-surface-3)] transition-colors"
                style={{ color: 'var(--color-text-secondary)' }}
                title="Delete selected"
              >
                <Trash2 size={14} />
              </button>
              <button
                onClick={() => handleThreadAction(Array.from(selectedThreadIds), 'markRead')}
                className="h-7 w-7 flex items-center justify-center rounded hover:bg-[var(--color-surface-3)] transition-colors"
                style={{ color: 'var(--color-text-secondary)' }}
                title="Mark selected as read"
              >
                <MailOpen size={14} />
              </button>
              <button
                onClick={() => handleThreadAction(Array.from(selectedThreadIds), 'markUnread')}
                className="h-7 w-7 flex items-center justify-center rounded hover:bg-[var(--color-surface-3)] transition-colors"
                style={{ color: 'var(--color-text-secondary)' }}
                title="Mark selected as unread"
              >
                <Mail size={14} />
              </button>
              <button
                onClick={() => setSnoozingThreadIds(Array.from(selectedThreadIds))}
                className="h-7 w-7 flex items-center justify-center rounded hover:bg-[var(--color-surface-3)] transition-colors"
                style={{ color: 'var(--color-text-secondary)' }}
                title="Snooze selected"
              >
                <Clock size={14} />
              </button>
            </div>
          </div>
        ) : (
          /* ── Folders & Select All Row ── */
          <div
            className="flex items-center justify-between px-4 py-2 border-b bg-[var(--color-surface-1)]"
            style={{ borderColor: 'var(--color-surface-2)' }}
          >
            <div className="flex items-center gap-2">
              <button
                onClick={selectAllThreads}
                className="h-5 w-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors hover:border-[var(--color-text-tertiary)] bg-[var(--color-surface-0)]"
                style={{ borderColor: 'var(--color-surface-3)' }}
                title="Select all"
              >
                <Check size={10} style={{ color: 'var(--color-text-tertiary)', opacity: 0.6 }} />
              </button>
              <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                Select All
              </span>
            </div>

            {/* Folder tabs */}
            <div className="flex rounded-lg p-0.5 bg-[var(--color-surface-2)] border" style={{ borderColor: 'var(--color-surface-3)' }}>
              <button
                onClick={() => {
                  setFolder('inbox')
                  setSelectedThread(null)
                  setMessages([])
                }}
                className={`px-2 py-0.5 text-[10px] font-medium rounded-md transition-colors ${
                  folder === 'inbox'
                    ? 'bg-[var(--color-surface-0)] shadow-xs text-[var(--color-text-primary)] font-semibold'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                Inbox
              </button>
              <button
                onClick={() => {
                  setFolder('snoozed')
                  setSelectedThread(null)
                  setMessages([])
                }}
                className={`px-2 py-0.5 text-[10px] font-medium rounded-md transition-colors ${
                  folder === 'snoozed'
                    ? 'bg-[var(--color-surface-0)] shadow-xs text-[var(--color-text-primary)] font-semibold'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                Snoozed
              </button>
              <button
                onClick={() => {
                  setFolder('archived')
                  setSelectedThread(null)
                  setMessages([])
                }}
                className={`px-2 py-0.5 text-[10px] font-medium rounded-md transition-colors ${
                  folder === 'archived'
                    ? 'bg-[var(--color-surface-0)] shadow-xs text-[var(--color-text-primary)] font-semibold'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                Archived
              </button>
            </div>
          </div>
        )}

        {/* Contacts panel */}
        <ContactsPanel dealId={dealId} onEmailClick={handleContactEmailClick} />

        {/* Thread items */}
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
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <Mail size={28} style={{ color: 'var(--color-text-tertiary)', opacity: 0.5, marginBottom: 12 }} />
              <p className="text-[13px] font-medium" style={{ color: 'var(--color-text-primary)' }}>
                {folder === 'snoozed' ? 'No snoozed threads' : folder === 'archived' ? 'No archived threads' : 'No conversations yet'}
              </p>
              <p className="text-[11px] mt-1 mb-4" style={{ color: 'var(--color-text-tertiary)' }}>
                {folder === 'inbox' && 'Send your first outreach email'}
              </p>
              {folder === 'inbox' && (
                <button
                  onClick={openCompose}
                  className="h-7 px-3 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1"
                  style={{ background: 'var(--color-accent)', color: 'var(--color-text-inverse)' }}
                >
                  <Edit size={11} />
                  Compose
                </button>
              )}
            </div>
          ) : (
            threads.map((thread) => {
              const isSelected = selectedThread?.threadId === thread.threadId
              const isUnread = thread.isUnread
              const isChecked = selectedThreadIds.has(thread.threadId)
              return (
                <div
                  key={thread.threadId}
                  className="group flex items-start gap-2 px-3 py-3 border-b transition-colors hover:bg-[var(--color-surface-1)] relative"
                  style={{
                    borderColor: 'var(--color-surface-2)',
                    background: isSelected ? 'var(--color-surface-1)' : undefined,
                  }}
                >
                  {/* Checkbox */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleThreadSelection(thread.threadId) }}
                    className="h-5 w-5 rounded border flex items-center justify-center flex-shrink-0 mt-1 transition-colors hover:border-[var(--color-text-tertiary)] bg-[var(--color-surface-0)]"
                    style={{
                      borderColor: isChecked ? 'var(--color-accent)' : 'var(--color-surface-3)',
                      background: isChecked ? 'var(--color-accent-bg)' : 'transparent',
                    }}
                  >
                    {isChecked && <Check size={10} style={{ color: 'var(--color-accent)' }} />}
                  </button>

                  {/* Content (click to open) */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => openThread(thread)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        openThread(thread)
                      }
                    }}
                    className="flex-1 flex items-start gap-3 min-w-0 text-left cursor-pointer outline-none"
                  >
                    {/* Avatar */}
                    <div
                      className="h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold"
                      style={{
                        background: isUnread ? 'var(--color-accent)' : avatarColor(thread.contactName),
                        color: 'var(--color-text-inverse)',
                      }}
                    >
                      {initials(thread.contactName)}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Name + date */}
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-[13px] truncate ${isUnread ? 'font-bold' : 'font-normal'}`}
                          style={{ color: isUnread ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}
                        >
                          {thread.contactName ?? thread.contactEmail ?? 'Unknown'}
                        </span>
                        <span className="text-[11px] flex-shrink-0 ml-2 group-hover:opacity-0 transition-opacity" style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-jetbrains-mono)' }}>
                          {formatEmailDate(thread.lastDate)}
                        </span>
                      </div>

                      {/* Subject & Snippet */}
                      <p className="text-[12px] truncate mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                        <span className={isUnread ? 'font-bold text-[var(--color-text-primary)]' : 'font-normal text-[var(--color-text-secondary)]'}>
                          {thread.subject ?? '(no subject)'}
                        </span>
                        {thread.snippet && (
                          <span className="font-normal" style={{ color: 'var(--color-text-tertiary)' }}>
                            {' — '}{thread.snippet}
                          </span>
                        )}
                      </p>

                      {/* Meta row */}
                      <div className="flex items-center gap-1.5 mt-1">
                        {thread.isPortfolioSibling && (
                          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium"
                            style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-secondary)' }}>
                            <FolderKanban size={9} />
                            {thread.dealName ?? 'Portfolio'}
                          </span>
                        )}
                        {thread.status === 'replied' && (
                          <span className="text-[10px]" style={{ color: 'var(--color-success-text)' }}>Replied</span>
                        )}
                        {isUnread && (
                          <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: 'var(--color-accent)' }} />
                        )}
                        {thread.snoozedUntil && (
                          <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                            <Clock size={10} />
                            Snoozed
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Hover Actions Bar - replaces date container on hover */}
                  <div className="absolute right-3 top-3 hidden group-hover:flex items-center gap-1 bg-[var(--color-surface-1)] pl-2">
                    {thread.isInbox && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleThreadAction([thread.threadId], 'archive') }}
                        className="h-7 w-7 flex items-center justify-center rounded hover:bg-[var(--color-surface-2)] transition-colors"
                        style={{ color: 'var(--color-text-secondary)' }}
                        title="Archive"
                      >
                        <Archive size={14} />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleThreadAction([thread.threadId], 'delete') }}
                      className="h-7 w-7 flex items-center justify-center rounded hover:bg-[var(--color-surface-2)] transition-colors"
                      style={{ color: 'var(--color-text-secondary)' }}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleThreadAction([thread.threadId], thread.isUnread ? 'markRead' : 'markUnread')
                      }}
                      className="h-7 w-7 flex items-center justify-center rounded hover:bg-[var(--color-surface-2)] transition-colors"
                      style={{ color: 'var(--color-text-secondary)' }}
                      title={thread.isUnread ? 'Mark as read' : 'Mark as unread'}
                    >
                      {thread.isUnread ? <MailOpen size={14} /> : <Mail size={14} />}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSnoozingThreadIds([thread.threadId]) }}
                      className="h-7 w-7 flex items-center justify-center rounded hover:bg-[var(--color-surface-2)] transition-colors"
                      style={{ color: 'var(--color-text-secondary)' }}
                      title="Snooze"
                    >
                      <Clock size={14} />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ═══ Right Panel (thread view) ════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col relative" style={{ background: 'var(--color-canvas)' }}>
        {!selectedThread ? (
          /* ── Empty / placeholder ─────────────────────────────────────── */
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
                <Edit size={11} />
                Compose
              </button>
            </div>
          </div>
        ) : messagesLoading ? (
          /* ── Loading messages ────────────────────────────────────────── */
          <div className="flex-1 flex items-center justify-center">
            <LoadingSpinner size="md" />
          </div>
        ) : (
          /* ── Gmail-style thread view ────────────────────────────────── */
          <div className="flex flex-col h-full">
            {/* Thread header */}
            <div
              className="flex items-center justify-between px-4 h-[53px] border-b flex-shrink-0"
              style={{ borderColor: 'var(--color-surface-2)' }}
            >
              {/* Left side actions (Archive, Snooze, Reply) */}
              <div className="flex items-center gap-1.5">
                {selectedThread.isInbox && (
                  <button
                    onClick={() => handleThreadAction([selectedThread.threadId], 'archive')}
                    className="h-7 px-2.5 rounded text-[11px] font-medium transition-colors hover:bg-[var(--color-surface-2)] flex items-center gap-1"
                    style={{ color: 'var(--color-text-secondary)' }}
                    title="Archive thread"
                  >
                    <Archive size={13} />
                    Archive
                  </button>
                )}
                <button
                  onClick={() => setSnoozingThreadIds([selectedThread.threadId])}
                  className="h-7 px-2.5 rounded text-[11px] font-medium transition-colors hover:bg-[var(--color-surface-2)] flex items-center gap-1"
                  style={{ color: 'var(--color-text-secondary)' }}
                  title="Snooze thread"
                >
                  <Clock size={13} />
                  Snooze
                </button>
              </div>

              {/* Right side actions (Expand/Collapse, Open in Gmail) */}
              <div className="flex items-center gap-1.5">
                {expandedCount > 0 && (
                  <button
                    onClick={collapseAllMessages}
                    className="h-7 px-2 rounded text-[11px] font-medium transition-colors hover:bg-[var(--color-surface-2)]"
                    style={{ color: 'var(--color-text-tertiary)' }}
                    title="Collapse all"
                  >
                    <ChevronUp size={14} />
                  </button>
                )}
                {!allExpanded && messages.length > 0 && (
                  <button
                    onClick={expandAllMessages}
                    className="h-7 px-2 rounded text-[11px] font-medium transition-colors hover:bg-[var(--color-surface-2)]"
                    style={{ color: 'var(--color-text-tertiary)' }}
                    title="Expand all"
                  >
                    <ChevronDown size={14} />
                  </button>
                )}
                {selectedThread?.threadId && (
                  <a
                    href={`https://mail.google.com/mail/u/0/#inbox/${selectedThread.threadId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-7 w-7 flex items-center justify-center rounded transition-colors hover:bg-[var(--color-surface-2)]"
                    style={{ color: 'var(--color-text-tertiary)' }}
                    title="Open in Gmail"
                  >
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            </div>

            {/* Messages — collapsible, stacked */}
            <div className="flex-1 overflow-y-auto">
              {/* Thread Subject Header */}
              <div className="px-5 py-4 border-b bg-[var(--color-surface-0)] flex flex-col gap-1.5 flex-shrink-0" style={{ borderColor: 'var(--color-surface-2)' }}>
                <h3 className="text-[16px] font-semibold tracking-tight" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans)' }}>
                  {selectedThread?.subject ?? '(no subject)'}
                </h3>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[12px] font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                    {selectedThread?.contactName ?? 'Unknown'}
                  </span>
                  {selectedThread?.contactEmail && (
                    <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>&lt;{selectedThread.contactEmail}&gt;</span>
                  )}
                </div>
              </div>
              {messages.map((msg, idx) => {
                const isExpanded = expandedMessages.has(msg.id)
                const own = isOwnMessage(msg.from)
                const isMsgUnread = msg.labelIds?.includes('UNREAD') ?? false
                return (
                  <div
                    key={msg.id}
                    className="border-b"
                    style={{ borderColor: 'var(--color-surface-2)' }}
                  >
                    {/* Clickable header row */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleMessageExpand(msg.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          toggleMessageExpand(msg.id)
                        }
                      }}
                      className="w-full text-left px-5 py-3 flex items-start gap-3 transition-colors hover:bg-[var(--color-surface-1)] cursor-pointer outline-none"
                    >
                      {!isExpanded ? (
                        /* Collapsed State: single horizontal row */
                        <div className="flex items-center justify-between w-full min-w-0">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div
                              className="h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
                              style={{
                                background: own ? 'var(--color-surface-3)' : avatarColor(msg.from),
                                color: own ? 'var(--color-text-secondary)' : 'var(--color-text-inverse)',
                              }}
                            >
                              {initials(msg.from)}
                            </div>
                            <span
                              className={`text-[13px] truncate w-[140px] flex-shrink-0 ${isMsgUnread ? 'font-bold' : 'font-medium'}`}
                              style={{ color: isMsgUnread ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}
                            >
                              {own ? 'me' : parseSenderName(msg.from)}
                            </span>
                            <span
                              className={`text-[12px] truncate flex-1 ${isMsgUnread ? 'font-semibold' : 'font-normal'}`}
                              style={{ color: isMsgUnread ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)' }}
                            >
                              {msg.snippet}
                            </span>
                          </div>
                          <span className="text-[11px] flex-shrink-0 ml-3" style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-jetbrains-mono)' }}>
                            {formatEmailDate(msg.date)}
                          </span>
                        </div>
                      ) : (
                        /* Expanded State: richer layout */
                        <div className="flex items-start gap-3 w-full min-w-0">
                          <div
                            className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold mt-0.5"
                            style={{
                              background: own ? 'var(--color-surface-3)' : avatarColor(msg.from),
                              color: own ? 'var(--color-text-secondary)' : 'var(--color-text-inverse)',
                            }}
                          >
                            {initials(msg.from)}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className={`text-[13px] truncate ${isMsgUnread ? 'font-bold' : 'font-semibold'}`}
                                  style={{ color: isMsgUnread ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}
                                >
                                  {own ? 'me' : parseSenderName(msg.from)}
                                </span>
                                <span className="text-[11px] truncate hidden sm:inline" style={{ color: 'var(--color-text-tertiary)' }}>
                                  &lt;{parseSenderEmail(msg.from)}&gt;
                                </span>
                                {idx === messages.length - 1 && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                                    style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-secondary)' }}>
                                    latest
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 flex-shrink-0 ml-3" onClick={(e) => e.stopPropagation()}>
                                <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-jetbrains-mono)' }}>
                                  {formatEmailFullDate(msg.date)}
                                </span>

                                {/* Quick reply icon button */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setComposerDefaults({
                                      to: msg.from,
                                      subject: selectedThread?.subject ? `Re: ${selectedThread.subject}` : '',
                                    })
                                    setComposeMode('reply')
                                    setComposeMinimized(false)
                                    setComposeOpen(false)
                                    setDraftBody('')
                                    setDraftCc('')
                                    setAttachments([])
                                  }}
                                  className="h-6 w-6 flex items-center justify-center rounded hover:bg-[var(--color-surface-2)] transition-colors text-[var(--color-text-secondary)]"
                                  title="Reply"
                                >
                                  <Reply size={13} />
                                </button>

                                {/* Three-dots actions menu */}
                                <div className="relative">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setActiveMenuMsgId(activeMenuMsgId === msg.id ? null : msg.id)
                                    }}
                                    className="h-6 w-6 flex items-center justify-center rounded hover:bg-[var(--color-surface-2)] transition-colors text-[var(--color-text-secondary)]"
                                    title="More options"
                                  >
                                    <MoreVertical size={13} />
                                  </button>

                                  {activeMenuMsgId === msg.id && (
                                    <>
                                      <div className="fixed inset-0 z-40" onClick={() => setActiveMenuMsgId(null)} />
                                      <div
                                        className="absolute right-0 mt-1 w-36 rounded-lg border shadow-lg z-50 py-1 animate-dropdown-show"
                                        style={{
                                          background: 'var(--color-surface-0)',
                                          borderColor: 'var(--color-surface-2)',
                                          boxShadow: 'var(--shadow-md)',
                                        }}
                                      >
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setActiveMenuMsgId(null)
                                            setComposerDefaults({
                                              to: msg.from,
                                              subject: selectedThread?.subject ? `Re: ${selectedThread.subject}` : '',
                                            })
                                            setComposeMode('reply')
                                            setComposeMinimized(false)
                                            setComposeOpen(false)
                                            setDraftBody('')
                                            setDraftCc('')
                                            setAttachments([])
                                          }}
                                          className="w-full text-left px-3 py-1.5 text-[12px] hover:bg-[var(--color-surface-1)] transition-colors flex items-center gap-1.5"
                                          style={{ color: 'var(--color-text-primary)' }}
                                        >
                                          <Reply size={12} />
                                          Reply
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setActiveMenuMsgId(null)
                                            const header = `
                                              <br><br>---------- Forwarded message ---------<br>
                                              From: <b>${escapeHtml(msg.from)}</b><br>
                                              Date: ${msg.date}<br>
                                              Subject: ${msg.subject || selectedThread?.subject || ''}<br>
                                              To: ${escapeHtml(msg.to)}<br><br>
                                            `
                                            const forwardBody = header + msg.body

                                            setComposerDefaults({
                                              to: '',
                                              subject: selectedThread?.subject ? `Fwd: ${selectedThread.subject}` : 'Fwd: (no subject)',
                                            })
                                            setComposeMode('forward')
                                            setComposeMinimized(false)
                                            setComposeOpen(false)
                                            setDraftBody(forwardBody)
                                            setDraftCc('')
                                            setAttachments([])
                                          }}
                                          className="w-full text-left px-3 py-1.5 text-[12px] hover:bg-[var(--color-surface-1)] transition-colors flex items-center gap-1.5"
                                          style={{ color: 'var(--color-text-primary)' }}
                                        >
                                          <Forward size={12} />
                                          Forward
                                        </button>
                                        <div className="border-t my-1" style={{ borderColor: 'var(--color-surface-2)' }} />
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setActiveMenuMsgId(null)
                                            if (selectedThread) {
                                              setDeleteMsgId(msg.id)
                                              setDeleteMsgThreadId(selectedThread.threadId)
                                            }
                                          }}
                                          className="w-full text-left px-3 py-1.5 text-[12px] hover:bg-[var(--color-surface-1)] text-[var(--color-danger-text)] transition-colors flex items-center gap-1.5 font-medium"
                                        >
                                          <Trash2 size={12} />
                                          Delete message
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                                to {msg.to}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Expanded body */}
                    {isExpanded && (
                      <div className="px-5 pb-4 animate-tab-entrance">
                        <div
                          className="text-[13px] leading-relaxed max-w-none"
                          style={{
                            color: 'var(--color-text-secondary)',
                            wordBreak: 'break-word',
                            paddingLeft: 48,
                          }}
                        >
                          {msg.body ? (
                            <div
                              dangerouslySetInnerHTML={{ __html: msg.body }}
                              className="email-content"
                            />
                          ) : (
                            <p className="italic" style={{ color: 'var(--color-text-tertiary)' }}>{msg.snippet}</p>
                          )}
                        </div>

                        {/* Received Attachments */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-2" style={{ paddingLeft: 48 }}>
                            {msg.attachments.map((att) => (
                              <a
                                key={att.attachmentId}
                                href={`/api/deals/${dealId}/emails/attachments?messageId=${msg.id}&attachmentId=${att.attachmentId}&filename=${encodeURIComponent(att.filename)}`}
                                download={att.filename}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] bg-[var(--color-surface-0)] border-[var(--color-surface-3)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-all cursor-pointer shadow-xs active:scale-98"
                              >
                                <Paperclip size={12} className="text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] flex-shrink-0" />
                                {renderAttachmentName(att.filename)}
                                <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-jetbrains-mono)' }}>
                                  ({(att.size / 1024).toFixed(0)} KB)
                                </span>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
              {/* Bottom reply/forward pills (Gmail-style) at the end of the thread */}
              {messages.length > 0 && composeMode === null && !composeOpen && (
                <div className="px-5 py-6 flex items-center gap-3 border-t animate-tab-entrance" style={{ paddingLeft: 68, borderColor: 'var(--color-surface-2)' }}>
                  <button
                    onClick={() => {
                      setComposerDefaults({
                        to: messages[messages.length - 1]!.from,
                        subject: selectedThread?.subject ? `Re: ${selectedThread.subject}` : '',
                      })
                      setComposeMode('reply')
                      setComposeMinimized(false)
                      setComposeOpen(false)
                      setDraftBody('')
                      setDraftCc('')
                      setAttachments([])
                    }}
                    className="h-8 px-5 rounded-full border text-[12px] font-medium transition-all inline-flex items-center gap-1.5 bg-[var(--color-surface-0)] border-[var(--color-surface-3)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] active:scale-98 shadow-xs cursor-pointer"
                  >
                    <Reply size={13} />
                    Reply
                  </button>
                  <button
                    onClick={() => {
                      const lastMsg = messages[messages.length - 1]!
                      const header = `
                        <br><br>---------- Forwarded message ---------<br>
                        From: <b>${escapeHtml(lastMsg.from)}</b><br>
                        Date: ${lastMsg.date}<br>
                        Subject: ${lastMsg.subject || selectedThread?.subject || ''}<br>
                        To: ${escapeHtml(lastMsg.to)}<br><br>
                      `
                      const forwardBody = header + lastMsg.body

                      setComposerDefaults({
                        to: '',
                        subject: selectedThread?.subject ? `Fwd: ${selectedThread.subject}` : 'Fwd: (no subject)',
                      })
                      setComposeMode('forward')
                      setComposeMinimized(false)
                      setComposeOpen(false)
                      setDraftBody(forwardBody)
                      setDraftCc('')
                      setAttachments([])
                    }}
                    className="h-8 px-5 rounded-full border text-[12px] font-medium transition-all inline-flex items-center gap-1.5 bg-[var(--color-surface-0)] border-[var(--color-surface-3)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] active:scale-98 shadow-xs cursor-pointer"
                  >
                    <Forward size={13} />
                    Forward
                  </button>
                </div>
              )}
            </div>

            {/* Bottom reply block (Inline Editor vs Button) */}
            {messages.length > 0 && (
              (composeMode === 'reply' || composeMode === 'forward') && !composeOpen ? (
                /* ── Inline Reply/Forward Composer ──────────────────────────────── */
                <div className="px-5 py-4 border-t flex-shrink-0 flex flex-col min-h-0 max-h-[500px]" style={{ borderColor: 'var(--color-surface-2)', background: 'var(--color-surface-0)' }}>
                  <div className="flex items-center justify-between mb-3 flex-shrink-0">
                    <span className="text-[12px] font-semibold flex items-center gap-1.5" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans)' }}>
                      {composeMode === 'reply' ? (
                        <>
                          <Reply size={13} />
                          Reply to <span className="font-normal text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>{composerDefaults.to}</span>
                        </>
                      ) : (
                        <>
                          <Forward size={13} />
                          Forward message
                        </>
                      )}
                    </span>
                    <button
                      onClick={popOutReply}
                      className="h-6 px-2 flex items-center gap-1 text-[10px] font-semibold rounded hover:bg-[var(--color-surface-2)] transition-colors border"
                      style={{ color: 'var(--color-text-secondary)', borderColor: 'var(--color-surface-3)' }}
                      title={composeMode === 'reply' ? "Pop out reply" : "Pop out forward"}
                    >
                      <ExternalLink size={11} />
                      Pop out
                    </button>
                  </div>
                  <EmailComposer
                    ref={emailComposerRef}
                    className="flex-1 min-h-0"
                    mode="compose"
                    isReply={composeMode === 'reply'}
                    isForward={composeMode === 'forward'}
                    dealId={dealId}
                    defaultTo={composerDefaults.to}
                    defaultSubject={composerDefaults.subject}
                    defaultCc={draftCc}
                    defaultBody={draftBody}
                    onSend={handleSend}
                    sending={sending}
                    showCcToggle={composeMode !== 'forward'}
                    attachments={attachments}
                    onAttach={handleAttach}
                    onRemoveAttachment={handleRemoveAttachment}
                    onDiscard={dismissCompose}
                    minHeight={100}
                  />
                </div>
              ) : null
            )}
          </div>
        )}

        {/* ═══ Floating Compose Popup (bottom-right, Gmail-style, only when open) ═══ */}
        {composeOpen && (
          <div
            className={`absolute right-4 bottom-4 z-30 border rounded-xl shadow-lg overflow-hidden flex flex-col transition-all duration-200 ${
              composeMinimized ? 'h-10 w-56' : 'w-[540px] max-w-[calc(100%-32px)] h-[540px]'
            }`}
            style={{
              background: 'var(--color-surface-0)',
              borderColor: 'var(--color-border)',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            {/* Compose header bar */}
            <div
              className="flex items-center justify-between px-4 h-10 flex-shrink-0"
              style={{ background: 'var(--color-surface-1)' }}
            >
              <span className="text-[12px] font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                {composeMode === 'reply' ? 'Reply' : 'New Message'}
              </span>
              <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                <button
                  onClick={() => setComposeMinimized(!composeMinimized)}
                  className="h-6 w-6 flex items-center justify-center rounded hover:bg-[var(--color-surface-3)] transition-colors"
                  style={{ color: 'var(--color-text-tertiary)' }}
                  title={composeMinimized ? 'Maximize' : 'Minimize'}
                >
                  {composeMinimized ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
                </button>
                <button
                  onClick={dismissCompose}
                  className="h-6 w-6 flex items-center justify-center rounded hover:bg-[var(--color-surface-3)] transition-colors"
                  style={{ color: 'var(--color-text-tertiary)' }}
                  title="Close"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Compose body (hidden when minimized) */}
            {!composeMinimized && (
              <div className="flex-1 flex flex-col min-h-0 p-4">
                <EmailComposer
                  ref={emailComposerRef}
                  className="flex-1 min-h-0"
                  mode="compose"
                  dealId={dealId}
                  defaultTo={composerDefaults.to}
                  defaultSubject={composerDefaults.subject}
                  defaultCc={draftCc}
                  defaultBody={draftBody}
                  onSend={handleSend}
                  sending={sending}
                  showCcToggle
                  attachments={attachments}
                  onAttach={handleAttach}
                  onRemoveAttachment={handleRemoveAttachment}
                  onDiscard={dismissCompose}
                  isForward={composeMode === 'forward'}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete message confirmation dialog */}
      <Dialog open={deleteMsgId !== null} onOpenChange={(open) => { if (!open) setDeleteMsgId(null) }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--color-text-primary)' }}>Delete Message</DialogTitle>
            <DialogDescription style={{ color: 'var(--color-text-secondary)' }}>
              Are you sure you want to delete this message?
              <br />
              <span style={{ color: 'var(--color-text-tertiary)', fontSize: 12 }}>
                This action can be undone.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteMsgId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (deleteMsgId && deleteMsgThreadId) {
                  const id = deleteMsgId
                  const tid = deleteMsgThreadId
                  setDeleteMsgId(null)
                  setDeleteMsgThreadId(null)
                  await handleDeleteMessage(id, tid)
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </div>
  )
}
