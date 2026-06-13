'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { usePortfolio } from '@/lib/hooks/usePortfolios'
import { DealTable } from '@/components/deals/DealTable'
import DealDetailView from '@/components/deals/DealDetailView'

interface FieldDef {
  id: string; key: string; label: string; data_type: string; show_in_grid: boolean; sort_order: number
}

export default function PortfolioDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data: portfolio, isLoading } = usePortfolio(id)

  const { data: fieldDefs = [] } = useQuery<FieldDef[]>({
    queryKey: ['field-definitions', 'global'],
    queryFn: async () => {
      const res = await fetch('/api/field-definitions')
      if (!res.ok) return []
      const data = await res.json()
      return Array.isArray(data) ? data : []
    },
  })

  if (isLoading) {
    return <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
  }

  if (!portfolio) {
    return <EmptyState title="Portfolio not found" />
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const linkedDealId = (portfolio as any).portfolio_deal_id as string | undefined

  if (!linkedDealId) {
    return (
      <EmptyState
        title="Portfolio has no linked deal"
        description="This portfolio was created before the portfolio-as-deal feature. Please recreate it."
        action={{
          label: 'Back to Portfolios',
          onClick: () => router.push('/portfolios'),
        }}
      />
    )
  }

  // Child deals shown in the "Properties" tab
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const childDeals = (portfolio as any).deals ?? []

  const propertiesTab = {
    key: 'properties',
    label: `Properties (${Array.isArray(childDeals) ? childDeals.length : 0})`,
    content: (
      <div className="space-y-4">
        <div className="rounded-xl border p-6" style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-border)' }}>
          <div className="mb-4 pb-3 border-b border-[var(--color-surface-2)]">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Bundled Properties
            </h3>
            <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">
              Individual properties within this portfolio.
            </p>
          </div>
          {Array.isArray(childDeals) && childDeals.length > 0 ? (
            <DealTable
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              deals={childDeals as any}
              fieldDefs={fieldDefs}
              editable={false}
              excludeColumns={['portfolio']}
            />
          ) : (
            <p className="text-[13px] text-center py-8" style={{ color: 'var(--color-text-tertiary)' }}>
              No properties in this portfolio yet.
            </p>
          )}
        </div>
      </div>
    ),
  }

  // The global portfolio page doesn't have ProjectContext, but DealDetailView
  // uses useProjectContext. The linked deal has a project_id — we need to provide
  // the project context. Use the deal's project_id from the deal query.
  // Since we can't easily get project info here, we render without project context
  // and let the inner deal query handle missing project name gracefully.
  //
  // We wrap DealDetailView in a minimal context — but since ProjectProvider is
  // required by DealDetailView, we fetch projectId from the linked deal.
  // For simplicity, we pass projectId from the portfolio's project_id.

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const portfolioProjectId = (portfolio as any).project_id as string | undefined

  return (
    <DealDetailView
      projectId={portfolioProjectId ?? ''}
      dealId={linkedDealId}
      backHref="/portfolios"
      backLabel="Portfolios"
      extraTabs={[propertiesTab]}
    />
  )
}
