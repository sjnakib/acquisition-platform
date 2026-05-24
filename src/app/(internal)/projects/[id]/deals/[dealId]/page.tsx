'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { Building2 } from 'lucide-react'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { Breadcrumb } from '@/components/shared/Breadcrumb'
import { useProjectContext } from '@/components/shared/ProjectContext'
import { DealStageBar } from '@/components/deals/DealStageBar'
import { DealFieldsEditor } from '@/components/deals/DealFieldsEditor'
import { EmailInterface } from '@/components/deals/EmailInterface'
import { DocumentChecklist } from '@/components/deals/DocumentChecklist'
import { EvaluateUnderwritability } from '@/components/deals/EvaluateUnderwritability'
import { UnderwritingSummary } from '@/components/deals/UnderwritingSummary'
import { LOIDetail } from '@/components/deals/LOIDetail'
import { CallBriefTab } from '@/components/deals/CallBriefTab'
import { ActivityTimeline, type Activity } from '@/components/deals/ActivityTimeline'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'

interface DealHeader {
  id: string
  deal_name: string | null
  unit_count: number | null
  stage: string
  score: string | null
  created_at: string
  portfolio_id: string | null
}

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'emails', label: 'Emails' },
  { key: 'documents', label: 'Documents' },
  { key: 'underwriting', label: 'Underwriting' },
  { key: 'loi', label: 'LOI' },
  { key: 'calls', label: 'Follow-up Calls' },
]

const STAGE_BADGE_VARIANT: Record<string, 'neutral' | 'info' | 'warning' | 'accent' | 'success'> = {
  lead: 'neutral',
  outreach: 'info',
  response: 'info',
  underwriting: 'warning',
  loi: 'accent',
  closed: 'success',
  failed: 'neutral',
  archived: 'neutral',
}

export default function DealDetailPage({ params }: { params: Promise<{ id: string; dealId: string }> }) {
  const { id: projectId, dealId } = use(params)
  const { projectName } = useProjectContext()
  const router = useRouter()
  const [deal, setDeal] = useState<DealHeader | null>(null)
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

  return (
    <div>
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: 'Projects', href: '/projects' },
          { label: projectName, href: `/projects/${projectId}/deals` },
          { label: 'Deals', href: `/projects/${projectId}/deals` },
          { label: deal.deal_name ?? 'Untitled Deal' },
        ]}
      />

      {/* Header */}
      <div className="flex items-start justify-between mb-6 mt-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              {deal.deal_name ?? 'Untitled Deal'}
            </h1>
            <Badge variant={STAGE_BADGE_VARIANT[deal.stage] ?? 'neutral'} size="sm">
              {deal.stage.replace(/_/g, ' ')}
            </Badge>
          </div>
          {deal.unit_count ? (
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {deal.unit_count} units
              {deal.score ? ` · Score: ${deal.score.replace(/_/g, ' ')}` : ''}
            </p>
          ) : null}
        </div>
        <div className="mt-1">
          <DealStageBar stage={deal.stage} />
        </div>
      </div>

      {/* Tab navigation */}
      <div className="border-b mb-6" style={{ borderColor: 'var(--color-surface-2)' }}>
        <nav className="flex gap-1 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 pt-1 px-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
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

      {/* Tab content */}
      <div
        className="rounded-xl border p-6"
        style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-border)' }}
      >
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-[11px] font-medium uppercase tracking-[0.03em]" style={{ color: 'var(--color-text-tertiary)' }}>
                  Created
                </span>
                <p className="text-[13px] font-medium mt-0.5" style={{ color: 'var(--color-text-primary)' }}>
                  {formatDate(deal.created_at)}
                </p>
              </div>
              <div>
                <span className="text-[11px] font-medium uppercase tracking-[0.03em]" style={{ color: 'var(--color-text-tertiary)' }}>
                  Stage
                </span>
                <p className="text-[13px] font-medium mt-0.5 capitalize" style={{ color: 'var(--color-text-primary)' }}>
                  {deal.stage.replace(/_/g, ' ')}
                </p>
              </div>
              <div>
                <span className="text-[11px] font-medium uppercase tracking-[0.03em]" style={{ color: 'var(--color-text-tertiary)' }}>
                  Score
                </span>
                <p className="text-[13px] font-medium mt-0.5 capitalize" style={{ color: 'var(--color-text-primary)' }}>
                  {deal.score?.replace(/_/g, ' ') ?? '—'}
                </p>
              </div>
              <div>
                <span className="text-[11px] font-medium uppercase tracking-[0.03em]" style={{ color: 'var(--color-text-tertiary)' }}>
                  Units
                </span>
                <p className="text-[13px] font-medium mt-0.5" style={{ color: 'var(--color-text-primary)' }}>
                  {deal.unit_count ?? '—'}
                </p>
              </div>
            </div>

            <div className="border-t pt-6" style={{ borderColor: 'var(--color-surface-2)' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  Imported Fields
                </h3>
              </div>
              <DealFieldsEditor dealId={dealId} />
            </div>

            <div className="border-t pt-6" style={{ borderColor: 'var(--color-surface-2)' }}>
              <ActivityTimeline
                activities={activities}
                isLoading={activitiesLoading}
                onAddActivity={handleAddActivity}
              />
            </div>
          </div>
        )}

        {/* Emails Tab */}
        {activeTab === 'emails' && (
          <EmailInterface dealId={dealId} dealName={deal.deal_name} />
        )}

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <DocumentChecklist dealId={dealId} />
            <EvaluateUnderwritability dealId={dealId} unitCount={deal.unit_count} />
          </div>
        )}

        {/* Underwriting Tab */}
        {activeTab === 'underwriting' && (
          <UnderwritingSummary dealId={dealId} unitCount={deal.unit_count} />
        )}

        {/* LOI Tab */}
        {activeTab === 'loi' && (
          <LOIDetail dealId={dealId} />
        )}

        {/* Follow-up Calls Tab */}
        {activeTab === 'calls' && (
          <CallBriefTab dealId={dealId} />
        )}
      </div>
    </div>
  )
}
