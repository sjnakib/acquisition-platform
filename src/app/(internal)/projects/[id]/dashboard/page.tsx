'use client'

import { useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/shared/PageHeader'
import { FunnelMetrics } from '@/components/dashboard/FunnelMetrics'
import { KPIScorecard } from '@/components/dashboard/KPIScorecard'
import { ConversionChart } from '@/components/dashboard/ConversionChart'
import { PipelineTable } from '@/components/dashboard/PipelineTable'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { CreateCampaignDialog } from '@/components/campaigns/CreateCampaignDialog'
import { useProjectContext } from '@/components/shared/ProjectContext'
import { pageHeadings } from '@/lib/page-headings'
import { Building2, Megaphone, Upload } from 'lucide-react'

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
    data: pipeline = [],
    isLoading: pipelineLoading,
  } = useQuery<Array<{
    campaign_name: string
    market: string
    leads: number
    emails_sent: number
    responses_positive: number
    underwritten: number
    scored_good: number
    loi_count: number
    closed_count: number
  }>>({
    queryKey: ['pipeline', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/deals?limit=10000&project_id=${projectId}`)
      if (!res.ok) throw new Error('Failed to fetch pipeline')
      const json = await res.json()
      const deals = (json.data ?? []) as Array<Record<string, unknown>>
      const byCampaign = new Map<string, {
        campaign_name: string; market: string; leads: number; emails_sent: number
        responses_positive: number; underwritten: number; scored_good: number
        loi_count: number; closed_count: number
      }>()
      for (const d of deals) {
        const cName = (d.campaigns as { name: string; market: string } | null)?.name ?? 'Unassigned'
        const cMarket = (d.campaigns as { name: string; market: string } | null)?.market ?? '—'
        if (!byCampaign.has(cName)) {
          byCampaign.set(cName, {
            campaign_name: cName, market: cMarket,
            leads: 0, emails_sent: 0, responses_positive: 0,
            underwritten: 0, scored_good: 0, loi_count: 0, closed_count: 0,
          })
        }
        const row = byCampaign.get(cName)!
        row.leads++
        if ((d.stage as string) !== 'lead') row.emails_sent++
        const outreach = d.email_outreach as Array<{ status: string; response_classification: string }> | undefined
        if (outreach?.length) {
          if (outreach.some((o) => o.status === 'sent' || o.status === 'replied')) row.emails_sent++
          if (outreach.some((o) => o.response_classification === 'positive')) row.responses_positive++
        }
        if ((d.stage as string) === 'underwriting' || (d.stage as string) === 'scored') row.underwritten++
        if ((d.score as string) === 'good' || (d.score as string) === 'very_good') row.scored_good++
        if ((d.stage as string) === 'loi') row.loi_count++
        if ((d.stage as string) === 'closed') row.closed_count++
      }
      return Array.from(byCampaign.values())
    },
    enabled: dealsTotal > 0,
  })

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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <FunnelMetrics data={pipeline} />
            <ConversionChart data={pipeline} />
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans)' }}>Pipeline by Campaign</h3>
            <PipelineTable data={pipeline} />
          </div>
        </div>
      )}
    </div>
  )
}
