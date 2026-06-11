'use client'

import { use, useCallback, Suspense, lazy, useState, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Building2 } from 'lucide-react'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { Breadcrumb } from '@/components/shared/Breadcrumb'
import { useProjectContext } from '@/components/shared/ProjectContext'
import { DealStageBar } from '@/components/deals/DealStageBar'
import { DealFieldsEditor } from '@/components/deals/DealFieldsEditor'
import { DealEmailView } from '@/components/deals/DealEmailView'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useDeal } from '@/lib/hooks/useDeal'
import { useQuery, useQueryClient } from '@tanstack/react-query'

// ── Lazy-loaded tab components (non-default tabs) ──────────────────────────

const LazyDriveFileManager = lazy(() =>
  import('@/components/deals/DriveFileManager').then(m => ({ default: m.DriveFileManager }))
)
const LazyEvaluateUnderwritability = lazy(() =>
  import('@/components/deals/EvaluateUnderwritability').then(m => ({ default: m.EvaluateUnderwritability }))
)
const LazyUnderwritingSummary = lazy(() =>
  import('@/components/deals/UnderwritingSummary').then(m => ({ default: m.UnderwritingSummary }))
)
const LazyLOIDetail = lazy(() =>
  import('@/components/deals/LOIDetail').then(m => ({ default: m.LOIDetail }))
)
const LazyCallBriefTab = lazy(() =>
  import('@/components/deals/CallBriefTab').then(m => ({ default: m.CallBriefTab }))
)

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
  { key: 'documents', label: 'Deal Room' },
  { key: 'underwriting', label: 'Underwriting' },
  { key: 'loi', label: 'LOI' },
  { key: 'calls', label: 'Follow-up Calls' },
]

// Stage badge helper variants removed (badge deleted)

function DealDetailContent({ projectId, dealId }: { projectId: string; dealId: string }) {
  const { projectName } = useProjectContext()
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const { data: deal, isLoading: loading } = useDeal<DealHeader>(dealId)
  const activeTab = searchParams.get('tab') ?? 'overview'
  const setActiveTab = useCallback((tab: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [searchParams, router, pathname])

  // Track which tabs have been visited so lazy components only load on first activation
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(
    new Set([activeTab])
  )

  useEffect(() => {
    setVisitedTabs(prev => {
      if (prev.has(activeTab)) return prev
      const next = new Set(prev)
      next.add(activeTab)
      return next
    })
  }, [activeTab])



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
            onStageChange={() => {
              queryClient.invalidateQueries({ queryKey: ['deal', dealId] })
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
          <TabsContent className="overflow-y-auto" value="overview" keepMounted>
            <div className="space-y-6">
              {/* KPI highlight cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-xl border p-4 shadow-xs flex items-center gap-3 bg-[var(--color-surface-0)] border-[var(--color-surface-2)]">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[rgba(30,91,63,0.08)] border border-[rgba(30,91,63,0.15)] text-[var(--color-accent)] flex-shrink-0">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.03em] text-[var(--color-text-tertiary)] block">
                      Created
                    </span>
                    <p className="text-[13px] font-bold mt-0.5 font-mono text-[var(--color-text-primary)]">
                      {formatDate(deal.created_at)}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border p-4 shadow-xs flex items-center gap-3 bg-[var(--color-surface-0)] border-[var(--color-surface-2)]">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[var(--color-info-bg)] border border-[var(--color-info-border)] text-[var(--color-info-text)] flex-shrink-0">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h2a2 2 0 002-2zm12-3a2 2 0 00-2-2h-2a2 2 0 00-2 2v3a2 2 0 002 2h2a2 2 0 002-2v-3zm0 0V5a2 2 0 00-2-2h-2a2 2 0 00-2 2v14a2 2 0 002 2h2a2 2 0 002-2V5z" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.03em] text-[var(--color-text-tertiary)] block">
                      Stage
                    </span>
                    <p className="text-[13px] font-bold mt-0.5 capitalize text-[var(--color-text-primary)]">
                      {deal.stage.replace(/_/g, ' ')}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border p-4 shadow-xs flex items-center gap-3 bg-[var(--color-surface-0)] border-[var(--color-surface-2)]">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)] text-[var(--color-warning-text)] flex-shrink-0">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.907c.961 0 1.399 1.163.633 1.761l-3.971 2.89a1 1 0 00-.364 1.118l1.52 4.674c.3.922-.755 1.688-1.538 1.118l-3.971-2.89a1 1 0 00-1.175 0l-3.97 2.89c-.783.57-1.838-.197-1.538-1.118l1.52-4.674a1 1 0 00-.364-1.118L2.98 8.72c-.766-.598-.328-1.761.633-1.761h4.907a1 1 0 00.95-.69l1.519-4.674z" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.03em] text-[var(--color-text-tertiary)] block">
                      Score
                    </span>
                    <p className="text-[13px] font-bold mt-0.5 capitalize text-[var(--color-text-primary)]">
                      {deal.score?.replace(/_/g, ' ') ?? '—'}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border p-4 shadow-xs flex items-center gap-3 bg-[var(--color-surface-0)] border-[var(--color-surface-2)]">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[rgba(124,58,237,0.08)] border border-[rgba(124,58,237,0.15)] text-[rgb(124,58,237)] flex-shrink-0">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.03em] text-[var(--color-text-tertiary)] block">
                      Units
                    </span>
                    <p className="text-[13px] font-bold mt-0.5 font-mono text-[var(--color-text-primary)]">
                      {unitCount ?? '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Property Fields card - expanded full width */}
              <div className="rounded-xl border p-6 shadow-xs bg-[var(--color-surface-0)] border-[var(--color-surface-2)]">
                <div className="mb-4 pb-3 border-b border-[var(--color-surface-2)]">
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Property Fields
                  </h3>
                  <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">
                    Imported parameters and metadata spec sheets.
                  </p>
                </div>
                <DealFieldsEditor dealId={dealId} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="emails" keepMounted className="flex-1 min-h-0 flex flex-col">
            <DealEmailView dealId={dealId} dealName={dealName} projectId={projectId} />
          </TabsContent>

          <TabsContent className="overflow-y-auto" value="documents" keepMounted>
            {visitedTabs.has('documents') ? (
              <Suspense fallback={<div className="flex items-center justify-center py-10"><LoadingSpinner size="md" /></div>}>
                <div className="space-y-6">
                  <div className="rounded-xl border p-6" style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-border)' }}>
                    <LazyDriveFileManager dealId={dealId} dealName={dealName} />
                  </div>
                  <div className="rounded-xl border p-6" style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-border)' }}>
                    <LazyEvaluateUnderwritability dealId={dealId} unitCount={unitCount} />
                  </div>
                </div>
              </Suspense>
            ) : null}
          </TabsContent>

          <TabsContent className="overflow-y-auto" value="underwriting" keepMounted>
            {visitedTabs.has('underwriting') ? (
              <Suspense fallback={<div className="flex items-center justify-center py-10"><LoadingSpinner size="md" /></div>}>
                <div className="rounded-xl border p-6" style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-border)' }}>
                  <LazyUnderwritingSummary dealId={dealId} unitCount={unitCount} />
                </div>
              </Suspense>
            ) : null}
          </TabsContent>

          <TabsContent className="overflow-y-auto" value="loi" keepMounted>
            {visitedTabs.has('loi') ? (
              <Suspense fallback={<div className="flex items-center justify-center py-10"><LoadingSpinner size="md" /></div>}>
                <div className="rounded-xl border p-6" style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-border)' }}>
                  <LazyLOIDetail dealId={dealId} />
                </div>
              </Suspense>
            ) : null}
          </TabsContent>

          <TabsContent className="overflow-y-auto" value="calls" keepMounted>
            {visitedTabs.has('calls') ? (
              <Suspense fallback={<div className="flex items-center justify-center py-10"><LoadingSpinner size="md" /></div>}>
                <div className="rounded-xl border p-6" style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-border)' }}>
                  <LazyCallBriefTab dealId={dealId} />
                </div>
              </Suspense>
            ) : null}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

export default function DealDetailPage({ params }: { params: Promise<{ id: string; dealId: string }> }) {
  const { id, dealId } = use(params)
  return (
    <Suspense fallback={<LoadingSpinner size="lg" />}>
      <DealDetailContent projectId={id} dealId={dealId} />
    </Suspense>
  )
}
