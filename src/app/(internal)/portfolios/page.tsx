'use client'

import { useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { DealsPageView, type Deal } from '@/components/deals/DealsPageView'
import { useCreatePortfolio } from '@/lib/hooks/usePortfolios'
import { pageHeadings } from '@/lib/page-headings'

function PortfoliosContent() {
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
      })
      setDialogOpen(false)
      setName('')
      setDescription('')
      router.push(`/portfolios/${result.id}`)
    } catch {
      // toast handled by mutation
    }
  }

  return (
    <>
      <DealsPageView
        portfolioView
        columnOrderStorageKey="portfolios-global"
        onRowClick={(deal: Deal) => {
          // Navigate to global portfolio resolver
          router.push(`/portfolios/by-deal/${deal.id}`)
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

export default function PortfoliosPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>}>
      <PortfoliosContent />
    </Suspense>
  )
}
