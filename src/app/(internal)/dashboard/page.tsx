'use client'

import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/shared/PageHeader'
import { FunnelMetrics } from '@/components/dashboard/FunnelMetrics'
import { KPIScorecard } from '@/components/dashboard/KPIScorecard'
import { ConversionChart } from '@/components/dashboard/ConversionChart'
import { PipelineTable } from '@/components/dashboard/PipelineTable'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { pageHeadings } from '@/lib/page-headings'

interface PipelineRow {
  campaign_name: string
  market: string
  leads: number
  emails_sent: number
  responses_positive: number
  underwritten: number
  scored_good: number
  loi_count: number
  closed_count: number
}

export default function DashboardPage() {
  const { data: pipeline = [], isLoading: loading } = useQuery<PipelineRow[]>({
    queryKey: ['dashboard', 'pipeline'],
    queryFn: async () => {
      const res = await fetch('/api/deals?limit=5000&view=dashboard')
      const json = await res.json()
      const deals = (json.data ?? []) as Array<Record<string, unknown>>

      const byCampaign = new Map<string, PipelineRow>()
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
    staleTime: 60_000,
    gcTime: 5 * 60 * 1000,
  })

 if (loading) {
 return (
 <div>
      <PageHeader title={pageHeadings.dashboard.title} description={pageHeadings.dashboard.description} />
 <div className="flex items-center justify-center py-20">
 <LoadingSpinner size="lg" />
 </div>
 </div>
 )
 }

 return (
 <div>
      <PageHeader title={pageHeadings.dashboard.title} description={pageHeadings.dashboard.description} />
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
 </div>
 )
}
