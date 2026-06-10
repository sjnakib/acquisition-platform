'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { DeletePortfolioDialog } from '@/components/portfolios/DeletePortfolioDialog'
import { usePortfolio, useDeletePortfolio } from '@/lib/hooks/usePortfolios'
import { DealTable } from '@/components/deals/DealTable'

interface FieldDef {
  id: string
  key: string
  label: string
  data_type: string
  show_in_grid: boolean
  sort_order: number
}

export default function PortfolioDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: portfolio, isLoading } = usePortfolio(id)
  const deletePortfolio = useDeletePortfolio()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const { data: fieldDefs = [] } = useQuery<FieldDef[]>({
    queryKey: ['field-definitions', 'global'],
    queryFn: async () => {
      const res = await fetch('/api/field-definitions')
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

  const handleDelete = async (mode: 'orphan' | 'archive') => {
    await deletePortfolio.mutateAsync({ id, mode })
    router.push('/portfolios')
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.push('/portfolios')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-medium" style={{ color: 'var(--color-text-primary)' }}>{portfolio.name as string}</h1>
          {(portfolio.description as string) && (
            <p className="text-[13px] mt-1" style={{ color: 'var(--color-text-secondary)' }}>{portfolio.description as string}</p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)} style={{ borderColor: 'var(--color-danger-border)', color: 'var(--color-danger-text)' }}>
          <Trash2 className="h-4 w-4 mr-1" /> Delete
        </Button>
      </div>

      <p className="text-[13px] mb-6" style={{ color: 'var(--color-text-tertiary)' }}>{dealCount} deal{dealCount !== 1 ? 's' : ''} in this portfolio</p>

      {dealCount === 0 ? (
        <EmptyState title="No deals in this portfolio" />
      ) : (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <DealTable deals={deals as any} fieldDefs={fieldDefs} />
      )}

      <DeletePortfolioDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        portfolioName={portfolio.name as string}
        dealCount={dealCount}
        onDelete={handleDelete}
      />
    </div>
  )
}
