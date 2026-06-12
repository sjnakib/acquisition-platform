'use client'

import { useState, use, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { useCreatePortfolio } from '@/lib/hooks/usePortfolios'
import { DealsPageView, type Deal } from '@/components/deals/DealsPageView'
import { pageHeadings } from '@/lib/page-headings'

function PortfoliosContent({ projectId }: { projectId: string }) {
  const router = useRouter()
  const createPortfolio = useCreatePortfolio()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const handleCreate = async () => {
    if (!name.trim()) return
    try {
      const result = await createPortfolio.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        project_id: projectId,
      })
      setDialogOpen(false)
      setName('')
      setDescription('')
      // Navigate to the new portfolio detail page
      router.push(`/projects/${projectId}/portfolios/${result.id}`)
    } catch {
      // toast handled by mutation
    }
  }

  return (
    <>
      <DealsPageView
        projectId={projectId}
        portfolioView
        columnOrderStorageKey={`portfolios-${projectId}`}
        onRowClick={(deal: Deal) => {
          // For portfolio-linked deals, navigate to the portfolio detail page.
          // The DealTable row has the deal ID — we redirect to the portfolio
          // that links to this deal. We use a small helper: the portfolios
          // API includes portfolio_deal_id, but the DealTable uses deals.
          // Instead, navigate directly to a resolver URL that looks up
          // the portfolio from the linked deal ID.
          router.push(`/projects/${projectId}/portfolios/by-deal/${deal.id}`)
        }}
        title={pageHeadings.portfolios.title}
        description={pageHeadings.portfolios.description}
        onAdd={() => setDialogOpen(true)}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-surface-2)' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--color-text-primary)' }}>New Portfolio</DialogTitle>
            <DialogDescription style={{ color: 'var(--color-text-secondary)' }}>
              Create a new portfolio to bundle multiple properties together.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>Name</label>
              <Input className="h-[34px] text-[13px]" value={name} onChange={(e) => setName(e.target.value)} placeholder="Portfolio name" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>Description (optional)</label>
              <Input className="h-[34px] text-[13px]" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!name.trim() || createPortfolio.isPending} style={{ background: 'var(--accent)', color: 'var(--color-text-inverse)' }}>
              {createPortfolio.isPending ? <LoadingSpinner size="sm" /> : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default function PortfoliosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params)
  return (
    <Suspense fallback={<div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>}>
      <PortfoliosContent projectId={projectId} />
    </Suspense>
  )
}
