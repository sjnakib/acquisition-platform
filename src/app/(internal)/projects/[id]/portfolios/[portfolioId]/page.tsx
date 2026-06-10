'use client'

import { useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { useProjectContext } from '@/components/shared/ProjectContext'
import { DeletePortfolioDialog } from '@/components/portfolios/DeletePortfolioDialog'
import { usePortfolio, useDeletePortfolio } from '@/lib/hooks/usePortfolios'
import { DealTable } from '@/components/deals/DealTable'

interface FieldDef { id: string; key: string; label: string; data_type: string; show_in_grid: boolean; sort_order: number }

export default function PortfolioDetailPage({ params }: { params: Promise<{ id: string; portfolioId: string }> }) {
  const { id: projectId, portfolioId } = use(params)
  const { projectName } = useProjectContext()
  const router = useRouter()
  const { data: portfolio, isLoading } = usePortfolio(portfolioId)
  const deletePortfolio = useDeletePortfolio()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const { data: fieldDefs = [] } = useQuery<FieldDef[]>({
    queryKey: ['field-definitions', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/field-definitions?project_id=${projectId}`)
      if (!res.ok) return []
      const data = await res.json()
      return Array.isArray(data) ? data : []
    },
  })

  if (isLoading) return <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
  if (!portfolio) return <EmptyState title="Portfolio not found" />

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deals = (portfolio as any).deals ?? []
  const dealCount = Array.isArray(deals) ? deals.length : 0

  const backUrl = `/projects/${projectId}/portfolios`

  const handleDelete = async (mode: 'orphan' | 'archive') => {
    await deletePortfolio.mutateAsync({ id: portfolioId, mode })
    router.push(backUrl)
  }

  return (
    <div className="w-full">
      <div className="animate-item-entrance" style={{ animationDelay: '40ms' }}>
        <PageHeader
          title={portfolio.name as string}
          description={portfolio.description as string || undefined}
          breadcrumb={[
            { label: 'Projects', href: '/projects' },
            { label: projectName, href: `/projects/${projectId}/portfolios` },
            { label: 'Portfolios', href: `/projects/${projectId}/portfolios` },
            { label: portfolio.name as string },
          ]}
          actions={
            <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)} style={{ borderColor: 'var(--color-danger-border)', color: 'var(--color-danger-text)' }}>
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
          }
        />
      </div>

      <div className="animate-item-entrance" style={{ animationDelay: '100ms' }}>
        <p className="text-[13px] mb-6" style={{ color: 'var(--color-text-tertiary)' }}>{dealCount} deal{dealCount !== 1 ? 's' : ''} in this portfolio</p>
      </div>

      <div className="animate-item-entrance" style={{ animationDelay: '160ms' }}>
        {dealCount === 0 ? (
          <EmptyState title="No deals in this portfolio" />
        ) : (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          <DealTable deals={deals as any} fieldDefs={fieldDefs} onRowClick={(r: any) => router.push(`/projects/${projectId}/deals/${r.id}`)} />
        )}
      </div>

      <DeletePortfolioDialog
        open={deleteOpen} onOpenChange={setDeleteOpen}
        portfolioName={portfolio.name as string} dealCount={dealCount} onDelete={handleDelete}
      />
    </div>
  )
}
