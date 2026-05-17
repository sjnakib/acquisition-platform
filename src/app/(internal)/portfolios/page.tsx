'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { PortfolioCard } from '@/components/portfolios/PortfolioCard'
import { usePortfolios, useCreatePortfolio } from '@/lib/hooks/usePortfolios'
import { pageHeadings } from '@/lib/page-headings'

export default function PortfoliosPage() {
  const router = useRouter()
  const { data: portfolios, isLoading } = usePortfolios()
  const createPortfolio = useCreatePortfolio()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const handleCreate = async () => {
    if (!name.trim()) return
    try {
      const result = await createPortfolio.mutateAsync({ name: name.trim(), description: description.trim() || undefined })
      setDialogOpen(false)
      setName('')
      setDescription('')
      router.push(`/portfolios/${result.id}`)
    } catch {
      // toast handled by mutation
    }
  }

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={pageHeadings.portfolios.title}
        description={pageHeadings.portfolios.description}
        actions={
          <Button size="sm" onClick={() => setDialogOpen(true)} style={{ background: 'var(--accent)', color: '#FFF' }}>
            <Plus className="h-4 w-4 mr-1" /> New Portfolio
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : !portfolios?.length ? (
        <EmptyState
          title="No portfolios yet"
          description="Group deals into portfolios to track them together."
          action={{ label: 'Create Portfolio', onClick: () => setDialogOpen(true) }}
        />
      ) : (
        <div className="space-y-3 mt-6">
          {portfolios.map((p: { id: string; name: string; description: string | null; created_at: string; deals?: { id: string }[] }) => (
            <PortfolioCard
              key={p.id}
              id={p.id}
              name={p.name}
              description={p.description}
              dealCount={(p.deals as { id: string }[] | undefined)?.length ?? 0}
              createdAt={p.created_at}
            />
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-surface-2)' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--color-text-primary)' }}>New Portfolio</DialogTitle>
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
            <Button onClick={handleCreate} disabled={!name.trim() || createPortfolio.isPending} style={{ background: 'var(--accent)', color: '#FFF' }}>
              {createPortfolio.isPending ? <LoadingSpinner size="sm" /> : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
