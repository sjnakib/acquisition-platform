'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

interface DeletePortfolioDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  portfolioName: string
  dealCount: number
  onDelete: (mode: 'orphan' | 'archive') => Promise<void>
}

export function DeletePortfolioDialog({ open, onOpenChange, portfolioName, dealCount, onDelete }: DeletePortfolioDialogProps) {
  const [mode, setMode] = useState<'orphan' | 'archive' | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!mode || deleting) return
    setDeleting(true)
    try {
      await onDelete(mode)
      onOpenChange(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-surface-2)' }}>
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--color-text-primary)' }}>Delete &quot;{portfolioName}&quot;?</DialogTitle>
          <DialogDescription style={{ color: 'var(--color-text-secondary)' }}>
            This portfolio contains {dealCount} deal{dealCount !== 1 ? 's' : ''}. Choose what happens to them:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <label
            className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
              mode === 'orphan' ? 'ring-2' : ''
            }`}
            style={{
              background: mode === 'orphan' ? 'var(--color-accent-bg)' : 'var(--color-surface-0)',
              borderColor: mode === 'orphan' ? 'var(--accent)' : 'var(--color-surface-2)',
              outline: mode === 'orphan' ? '2px solid var(--accent)' : undefined,
            }}
            onClick={() => setMode('orphan')}
          >
            <input type="radio" className="mt-0.5" checked={mode === 'orphan'} onChange={() => setMode('orphan')} />
            <div>
              <p className="text-[14px] font-medium" style={{ color: 'var(--color-text-primary)' }}>Orphan the deals</p>
              <p className="text-[12px]" style={{ color: 'var(--color-text-tertiary)' }}>Deals stay active on the main board. Their portfolio is set to none.</p>
            </div>
          </label>

          <label
            className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
              mode === 'archive' ? 'ring-2' : ''
            }`}
            style={{
              background: mode === 'archive' ? 'var(--color-accent-bg)' : 'var(--color-surface-0)',
              borderColor: mode === 'archive' ? 'var(--accent)' : 'var(--color-surface-2)',
              outline: mode === 'archive' ? '2px solid var(--accent)' : undefined,
            }}
            onClick={() => setMode('archive')}
          >
            <input type="radio" className="mt-0.5" checked={mode === 'archive'} onChange={() => setMode('archive')} />
            <div>
              <p className="text-[14px] font-medium" style={{ color: 'var(--color-text-primary)' }}>Archive the deals</p>
              <p className="text-[12px]" style={{ color: 'var(--color-text-tertiary)' }}>Deals before LOI stage are archived. Deals at/beyond LOI are left untouched.</p>
            </div>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>Cancel</Button>
          <Button
            onClick={handleDelete}
            disabled={!mode || deleting}
            style={mode ? { background: 'var(--color-danger-solid)', color: '#FFF' } : undefined}
          >
            {deleting ? <LoadingSpinner size="sm" /> : 'Delete Portfolio'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
