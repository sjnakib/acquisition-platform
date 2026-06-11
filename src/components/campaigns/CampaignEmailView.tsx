'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Building2, ExternalLink, Mail } from 'lucide-react'
import { EmailThreadList, type EmailThread, type EmailThreadListHandle } from '@/components/shared/EmailThreadList'
import { EmailMessagePanel, type EmailMessage } from '@/components/shared/EmailMessagePanel'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

interface CampaignEmailViewProps {
  campaignId: string
  projectId: string
}

export function CampaignEmailView({ campaignId, projectId }: CampaignEmailViewProps) {
  const router = useRouter()

  const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null)
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set())
  const [gmailConnected, setGmailConnected] = useState<boolean | null>(null)
  const threadListRef = useRef<EmailThreadListHandle>(null)

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
    enabled: !!selectedThread,
    staleTime: 60_000,
  })

  useEffect(() => {
    if (messages.length > 0) {
      setExpandedMessages(new Set(messages.map((m) => m.id)))
    }
  }, [messages])

  const handleThreadClick = useCallback((thread: EmailThread) => {
    setSelectedThread(thread)
    // Mark as read (Gmail convention: opening a thread clears the unread label)
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

  // ── Navigation ──────────────────────────────────────────────────────────

  const navigateToDeal = useCallback((e: React.MouseEvent, dealId: string) => {
    e.stopPropagation()
    router.push(`/projects/${projectId}/deals/${dealId}?tab=emails`)
  }, [router, projectId])

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
            ref={threadListRef}
            apiBase={`/api/campaigns/${encodeURIComponent(campaignId)}/emails`}
            projectId={projectId}
            onThreadClick={handleThreadClick}
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
            // Loading connection status
            <div className="flex-1 flex items-center justify-center">
              <LoadingSpinner size="lg" />
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
                <p className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                  Emails are tracked across all deals in this campaign.
                </p>
              </div>
            </div>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  )
}
