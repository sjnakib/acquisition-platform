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
import { DealEmailView } from '@/components/deals/DealEmailView'
import { DriveFileManager } from '@/components/deals/DriveFileManager'
import { EvaluateUnderwritability } from '@/components/deals/EvaluateUnderwritability'
import { UnderwritingSummary } from '@/components/deals/UnderwritingSummary'
import { LOIDetail } from '@/components/deals/LOIDetail'
import { CallBriefTab } from '@/components/deals/CallBriefTab'
import { ActivityTimeline, type Activity } from '@/components/deals/ActivityTimeline'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

interface DealHeader {
  id: string
  stage: string
  score: string | null
  created_at: string
  portfolio_id: string | null
  deal_fields?: { value: string | null; field_definitions: { key: string; label: string; data_type: string } | null }[] | null
}

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'emails', label: 'Emails' },
  { key: 'documents', label: 'Documents' },
  { key: 'underwriting', label: 'Underwriting' },
  { key: 'loi', label: 'LOI' },
  { key: 'calls', label: 'Follow-up Calls' },
]

// Stage badge helper variants removed (badge deleted)

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
    const timer = setTimeout(() => {
      setLoading(true)
      setActivitiesLoading(true)
    }, 0)

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

    return () => clearTimeout(timer)
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

  const dealFields = deal.deal_fields ?? []
  const addrField = dealFields.find((f) => f.field_definitions?.key === 'address')
  const dealName = addrField?.value ?? 'Untitled Deal'

  const unitsField = dealFields.find((f) => f.field_definitions?.key === 'unit_count')
  const unitCount = unitsField?.value ? parseInt(unitsField.value, 10) : null

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: 'Projects', href: '/projects' },
          { label: projectName, href: `/projects/${projectId}/deals` },
          { label: 'Deals', href: `/projects/${projectId}/deals` },
          { label: dealName },
        ]}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-4 mt-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-semibold leading-none" style={{ color: 'var(--color-text-primary)' }}>
            {dealName}
          </h1>
          {unitCount && (
            <>
              <span style={{ color: 'var(--color-text-tertiary)' }} className="text-xs select-none">
                •
              </span>
              <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                {unitCount} units
              </span>
            </>
          )}
          {deal.score && (
            <>
              <span style={{ color: 'var(--color-text-tertiary)' }} className="text-xs select-none">
                •
              </span>
              <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                Score: {deal.score.replace(/_/g, ' ')}
              </span>
            </>
          )}
        </div>
        <div>
          <DealStageBar
            dealId={dealId}
            stage={deal.stage}
            onStageChange={(newStage) => {
              setDeal((prev) => (prev ? { ...prev, stage: newStage } : null))
            }}
          />
        </div>
      </div>

      <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="mb-4">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <TabsContent className="overflow-y-auto" value="overview">
            <div className="rounded-xl border p-6" style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-border)' }}>
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
                      {unitCount ?? '—'}
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
            </div>
          </TabsContent>

          <TabsContent value="emails" className="flex-1 min-h-0 flex flex-col">
            <DealEmailView dealId={dealId} dealName={dealName} projectId={projectId} />
          </TabsContent>

          <TabsContent className="overflow-y-auto" value="documents">
            <div className="space-y-6">
              <div className="rounded-xl border p-6" style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-border)' }}>
                <DriveFileManager dealId={dealId} dealName={dealName} />
              </div>
              <div className="rounded-xl border p-6" style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-border)' }}>
                <EvaluateUnderwritability dealId={dealId} unitCount={unitCount} />
              </div>
            </div>
          </TabsContent>

          <TabsContent className="overflow-y-auto" value="underwriting">
            <div className="rounded-xl border p-6" style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-border)' }}>
              <UnderwritingSummary dealId={dealId} unitCount={unitCount} />
            </div>
          </TabsContent>

          <TabsContent className="overflow-y-auto" value="loi">
            <div className="rounded-xl border p-6" style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-border)' }}>
              <LOIDetail dealId={dealId} />
            </div>
          </TabsContent>

          <TabsContent className="overflow-y-auto" value="calls">
            <div className="rounded-xl border p-6" style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-border)' }}>
              <CallBriefTab dealId={dealId} />
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
