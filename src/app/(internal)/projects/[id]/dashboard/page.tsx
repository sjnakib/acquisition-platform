'use client'

import { useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/shared/PageHeader'
import { PipelineAnalytics } from '@/components/dashboard/PipelineAnalytics'
import { KPIScorecard } from '@/components/dashboard/KPIScorecard'
import { CallStatistics } from '@/components/dashboard/CallStatistics'
import { TopOpportunities } from '@/components/dashboard/TopOpportunities'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { CreateCampaignDialog } from '@/components/campaigns/CreateCampaignDialog'
import { useProjectContext } from '@/components/shared/ProjectContext'
import { pageHeadings } from '@/lib/page-headings'
import { Megaphone, Upload } from 'lucide-react'

interface Campaign {
  id: string
  name: string
  market: string
}

export default function DashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params)
  const { projectName } = useProjectContext()
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)

  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery<Campaign[]>({
    queryKey: ['campaigns', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns?project_id=${projectId}`)
      if (!res.ok) throw new Error('Failed to fetch campaigns')
      return res.json()
    },
  })

  const { data: dealsTotal = 0, isLoading: dealsLoading } = useQuery<number>({
    queryKey: ['deals', 'total', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/deals?project_id=${projectId}&limit=1`)
      if (!res.ok) throw new Error('Failed to fetch deals')
      const json = await res.json()
      return json.total as number
    },
  })

  const {
    data: dashboardData = { pipeline: [], deals: [], callStats: { total: 0, pending: 0, completed: 0, cancelled: 0, published: 0 } },
    isLoading: pipelineLoading,
  } = useQuery<{
    pipeline: Array<{
      campaign_name: string
      market: string
      leads: number
      emails_sent: number
      awaiting_review: number
      responses_positive: number
      underwritten: number
      scored_good: number
      loi_count: number
      closed_count: number
    }>
    deals: Array<{
      id: string
      address: string | null
      unit_count: number | null
      stage: string
      score: string | null
      is_archived?: boolean
      created_at?: string
      market?: string
    }>
    callStats: {
      total: number
      pending: number
      completed: number
      cancelled: number
      published: number
    }
  }>({
    queryKey: ['pipeline', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/deals?limit=10000&project_id=${projectId}`)
      if (!res.ok) throw new Error('Failed to fetch pipeline')
      const json = await res.json()
      const deals = (json.data ?? []) as Array<Record<string, unknown>>
      
      // Calculate callStats from nested call_briefs
      let totalCalls = 0
      let pendingCalls = 0
      let completedCalls = 0
      let cancelledCalls = 0
      let publishedCalls = 0
      
      for (const d of deals) {
        const briefs = d.call_briefs as Array<{ id: string; call_status: 'pending' | 'completed' | 'cancelled'; published: boolean }> | undefined
        if (briefs) {
          for (const b of briefs) {
            totalCalls++
            if (b.call_status === 'pending') pendingCalls++
            else if (b.call_status === 'completed') completedCalls++
            else if (b.call_status === 'cancelled') cancelledCalls++
            
            if (b.published) publishedCalls++
          }
        }
      }

      // Aggregate deals by campaign for pipeline metrics
      const byCampaign = new Map<string, {
        campaign_name: string; market: string; leads: number; emails_sent: number
        awaiting_review: number; responses_positive: number; underwritten: number
        scored_good: number; loi_count: number; closed_count: number
      }>()
      for (const d of deals) {
        const cName = (d.campaigns as { name: string; market: string } | null)?.name ?? 'Unassigned'
        const cMarket = (d.campaigns as { name: string; market: string } | null)?.market ?? '—'
        if (!byCampaign.has(cName)) {
          byCampaign.set(cName, {
            campaign_name: cName, market: cMarket,
            leads: 0, emails_sent: 0, awaiting_review: 0, responses_positive: 0,
            underwritten: 0, scored_good: 0, loi_count: 0, closed_count: 0,
          })
        }
        const row = byCampaign.get(cName)!
        row.leads++
        const outreach = d.email_outreach as Array<{ status: string; response_classification: string; needs_review?: boolean; snoozed_until?: string | null }> | undefined
        const hasSentEmail = (d.stage as string) !== 'lead' || (outreach?.some((o) => o.status === 'sent' || o.status === 'replied') ?? false)
        if (hasSentEmail) row.emails_sent++

        if (outreach?.length) {
          if (outreach.some((o) => o.response_classification === 'positive')) row.responses_positive++
        }
        if (d.has_pending_review) {
          row.awaiting_review++
        }
        if ((d.stage as string) === 'underwriting' || (d.stage as string) === 'scored') row.underwritten++
        if ((d.score as string) === 'good' || (d.score as string) === 'very_good') row.scored_good++
        if ((d.stage as string) === 'loi') row.loi_count++
        if ((d.stage as string) === 'closed') row.closed_count++
      }
      return {
        pipeline: Array.from(byCampaign.values()),
        deals: deals.map((d) => ({
          id: d.id as string,
          address: d.address as string | null,
          unit_count: d.unit_count as number | null,
          stage: d.stage as string,
          score: d.score as string | null,
          is_archived: d.is_archived as boolean | undefined,
          created_at: d.created_at as string | undefined,
          market: (d.campaigns as { name: string; market: string } | null)?.market ?? 'Unassigned',
        })),
        callStats: {
          total: totalCalls,
          pending: pendingCalls,
          completed: completedCalls,
          cancelled: cancelledCalls,
          published: publishedCalls,
        }
      }
    },
    enabled: dealsTotal > 0,
  })

  const { pipeline = [], deals = [], callStats = { total: 0, pending: 0, completed: 0, cancelled: 0, published: 0 } } = dashboardData || {}
  const isLoading = campaignsLoading || dealsLoading

  if (isLoading) {
    return (
      <div>
        <PageHeader
          title={pageHeadings.dashboard.title}
          description={pageHeadings.dashboard.description}
          breadcrumb={[
            { label: 'Projects', href: '/projects' },
            { label: projectName, href: `/projects/${projectId}/dashboard` },
            { label: 'Dashboard' },
          ]}
        />
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    )
  }

  const hasDeals = dealsTotal > 0

  if (!hasDeals) {
    const hasCampaigns = campaigns.length > 0

    return (
      <div>
        <PageHeader
          title={pageHeadings.dashboard.title}
          description={pageHeadings.dashboard.description}
          breadcrumb={[
            { label: 'Projects', href: '/projects' },
            { label: projectName, href: `/projects/${projectId}/dashboard` },
            { label: 'Dashboard' },
          ]}
        />
        <div className="rounded-xl border p-12 flex flex-col items-center justify-center text-center bg-[var(--color-surface-0)] border-[var(--color-border)] shadow-[var(--shadow-xs)]">
          {hasCampaigns ? (
            <EmptyState
              icon={Upload}
              title="No Leads Imported Yet"
              description="Import your CoStar deals to populate this project and start tracking your pipeline."
              action={{
                label: 'Import Leads',
                onClick: () => router.push(`/projects/${projectId}/import`),
              }}
            />
          ) : (
            <EmptyState
              icon={Megaphone}
              title="Set Up Your First Campaign"
              description="Create an outreach campaign to organize and track deals for this project."
              action={{
                label: 'Create New Campaign',
                onClick: () => setCreateOpen(true),
              }}
            />
          )}
        </div>
        <CreateCampaignDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          projectId={projectId}
          onCreated={(campaign) => router.push(`/projects/${projectId}/campaigns/${campaign.id}`)}
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={pageHeadings.dashboard.title}
        description={pageHeadings.dashboard.description}
        breadcrumb={[
          { label: 'Projects', href: '/projects' },
          { label: projectName, href: `/projects/${projectId}/dashboard` },
          { label: 'Dashboard' },
        ]}
      />
      {pipelineLoading ? (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <div className="space-y-6">
          <KPIScorecard data={pipeline} />
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            <div className="lg:col-span-2">
              <PipelineAnalytics deals={deals} />
            </div>
            <div className="lg:col-span-1">
              <CallStatistics stats={callStats} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            <div className="lg:col-span-3">
              <TopOpportunities deals={deals} projectId={projectId} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
