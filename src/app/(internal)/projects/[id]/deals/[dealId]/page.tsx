'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { Building2 } from 'lucide-react'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { Breadcrumb } from '@/components/shared/Breadcrumb'
import { useProjectContext } from '@/components/shared/ProjectContext'
import { DealStageBar } from '@/components/deals/DealStageBar'
import { UnderwritingForm } from '@/components/deals/UnderwritingForm'
import { LOITracker } from '@/components/deals/LOITracker'
import { DocumentChecklist } from '@/components/deals/DocumentChecklist'
import { EmailThread } from '@/components/deals/EmailThread'
import { ActivityTimeline, type Activity } from '@/components/deals/ActivityTimeline'
import { CallBriefTab } from '@/components/deals/CallBriefTab'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'

interface Contact {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  title: string | null
  is_primary: boolean | null
}

interface DealDetail {
  id: string
  deal_name: string | null
  unit_count: number | null
  stage: string
  score: string | null
  created_at: string
  contacts: Contact[] | null
  email_outreach: { id: string; status: string; gmail_thread_id: string | null; gmail_message_id: string | null }[] | null
  underwriting: { id: string; underwritability: string | null; asking_price: number | null; irr_pct: number | null } | null
  loi_records: { id: string; submitted_at: string | null; offered_price: number | null; outcome: string | null } | null
  document_checklist: Record<string, unknown> | null
  call_briefs: { id: string; summary_text: string | null; call_status: string; published: boolean }[] | null
}

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'outreach', label: 'Outreach' },
  { key: 'documents', label: 'Documents' },
  { key: 'underwriting', label: 'Underwriting' },
  { key: 'loi', label: 'LOI' },
  { key: 'call_brief', label: 'Call Brief' },
]

export default function DealDetailPage({ params }: { params: Promise<{ id: string; dealId: string }> }) {
  const { id: projectId, dealId } = use(params)
  const { projectName } = useProjectContext()
  const router = useRouter()
  const [deal, setDeal] = useState<DealDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [activities, setActivities] = useState<Activity[]>([])
  const [activitiesLoading, setActivitiesLoading] = useState(false)

  useEffect(() => {
    if (!dealId) return
    setLoading(true)
    setActivitiesLoading(true)
    Promise.all([
      fetch(`/api/deals/${dealId}`).then((r) => r.json()),
      fetch(`/api/deals/${dealId}/activity`).then((r) => r.json()).catch(() => []),
    ])
      .then(([data, acts]) => {
        setDeal(data)
        setActivities(Array.isArray(acts) ? acts : [])
      })
      .catch(console.error)
      .finally(() => {
        setLoading(false)
        setActivitiesLoading(false)
      })
  }, [dealId])

  async function handleAddActivity(data: { type: string; summary: string }) {
    const res = await fetch(`/api/deals/${dealId}/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      const created = await res.json()
      setActivities((prev) => [created, ...prev])
      toast.success('Activity added')
    } else {
      const json = await res.json()
      toast.error(json.error ?? 'Failed to add activity')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!deal) {
    return (
      <EmptyState
        icon={Building2}
        title="Deal not found"
        action={{ label: 'Back to Deals', onClick: () => router.push(`/projects/${projectId}/deals`) }}
      />
    )
  }

  const stageBadgeVariant: Record<string, 'neutral' | 'info' | 'warning' | 'accent' | 'success'> = {
    lead: 'neutral',
    outreach: 'info',
    response: 'info',
    underwriting: 'warning',
    loi: 'accent',
    closed: 'success',
    failed: 'neutral',
    archived: 'neutral',
  }

  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'Projects', href: '/projects' },
          { label: projectName, href: `/projects/${projectId}/deals` },
          { label: 'Deals', href: `/projects/${projectId}/deals` },
          { label: deal.deal_name ?? 'Untitled Deal' },
        ]}
      />

      <div className="flex items-start justify-between mb-6 mt-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              {deal.deal_name ?? 'Untitled Deal'}
            </h1>
            <Badge variant={stageBadgeVariant[deal.stage] ?? 'neutral'} size="sm">
              {deal.stage.replace(/_/g, ' ')}
            </Badge>
          </div>
          {deal.unit_count ? (
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{deal.unit_count} units</p>
          ) : null}
        </div>
        <div className="mt-1">
          <DealStageBar stage={deal.stage} />
        </div>
      </div>

      <div className="border-b mb-6" style={{ borderColor: 'var(--color-surface-2)' }}>
        <nav className="flex gap-6">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key ? 'border-current' : 'border-transparent'
              }`}
              style={{
                color: activeTab === tab.key ? 'var(--accent)' : 'var(--color-text-tertiary)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="rounded-xl border p-6" style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-border)' }}>
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span style={{ color: 'var(--color-text-tertiary)' }}>Created</span>
                <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{formatDate(deal.created_at)}</p>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-tertiary)' }}>Score</span>
                <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{deal.score?.replace(/_/g, ' ') ?? '—'}</p>
              </div>
            </div>
            <ActivityTimeline
              activities={activities}
              isLoading={activitiesLoading}
              onAddActivity={handleAddActivity}
            />
          </div>
        )}

        {activeTab === 'contacts' && (
          <div>
            {!deal.contacts?.length ? (
              <EmptyState title="No contacts associated with this deal" />
            ) : (
              <div className="border rounded-md overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                <table className="w-full text-sm">
                  <thead style={{ background: 'var(--color-surface-1)' }}>
                    <tr>
                      <th className="text-left px-4 py-2 text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Name</th>
                      <th className="text-left px-4 py-2 text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Email</th>
                      <th className="text-left px-4 py-2 text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Phone</th>
                      <th className="text-left px-4 py-2 text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Title</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {deal.contacts.map((c) => (
                      <tr key={c.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                        <td className="px-4 py-2" style={{ color: 'var(--color-text-primary)' }}>
                          {c.full_name ?? '—'}
                          {c.is_primary && (
                            <span className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: 'var(--color-accent-bg)', color: 'var(--color-accent-muted)' }}>
                              Primary
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2" style={{ color: 'var(--color-text-secondary)' }}>{c.email ?? '—'}</td>
                        <td className="px-4 py-2" style={{ color: 'var(--color-text-secondary)' }}>{c.phone ?? '—'}</td>
                        <td className="px-4 py-2" style={{ color: 'var(--color-text-secondary)' }}>{c.title ?? '—'}</td>
                        <td className="px-2 py-2"></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'outreach' && (
          <div className="space-y-4">
            {!deal.email_outreach?.length ? (
              <EmptyState title="No outreach emails sent yet" />
            ) : (
              deal.email_outreach.map((eo) => (
                <div key={eo.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={eo.status === 'sent' ? 'success' : eo.status === 'replied' ? 'accent' : 'neutral'} size="sm">
                      {eo.status.replace(/_/g, ' ')}
                    </Badge>
                    <EmailThread gmailThreadId={eo.gmail_thread_id} gmailMessageId={eo.gmail_message_id} />
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'documents' && (
          <DocumentChecklist dealId={dealId} />
        )}

        {activeTab === 'underwriting' && (
          <UnderwritingForm dealId={dealId} unitCount={deal.unit_count} />
        )}

        {activeTab === 'loi' && (
          <LOITracker dealId={dealId} />
        )}

        {activeTab === 'call_brief' && (
          <CallBriefTab dealId={dealId} />
        )}
      </div>
    </div>
  )
}
