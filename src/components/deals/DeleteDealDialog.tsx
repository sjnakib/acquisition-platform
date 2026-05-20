'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

interface Props {
  dealNames: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void>
  /** When true, all rows across pages are selected. dealNames may be empty. */
  allSelected?: boolean
  totalCount?: number
}

export function DeleteDealDialog({ dealNames, open, onOpenChange, onConfirm, allSelected, totalCount }: Props) {
  const [deleting, setDeleting] = useState(false)
  const isSingle = !allSelected && dealNames.length === 1

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await onConfirm()
      toast.success(allSelected ? `${totalCount ?? 'All'} deals deleted` : isSingle ? 'Deal deleted' : `${dealNames.length} deals deleted`)
      onOpenChange(false)
    } catch {
      toast.error('Failed to delete deal(s)')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--color-text-primary)' }}>
            {allSelected ? `Delete All Deals` : isSingle ? 'Delete Deal' : `Delete ${dealNames.length} Deals`}
          </DialogTitle>
          <DialogDescription style={{ color: 'var(--color-text-secondary)' }}>
            {allSelected ? (
              <>
                Are you sure you want to delete <strong style={{ color: 'var(--color-text-primary)' }}>all {totalCount?.toLocaleString()}</strong> deals?
                <br />
                <span style={{ color: 'var(--color-text-tertiary)', fontSize: 12 }}>
                  This action cannot be undone.
                </span>
              </>
            ) : isSingle ? (
              <>
                Are you sure you want to delete{' '}
                <strong style={{ color: 'var(--color-text-primary)' }}>{dealNames[0]}</strong>?
                <br />
                <span style={{ color: 'var(--color-text-tertiary)', fontSize: 12 }}>
                  This action cannot be undone.
                </span>
              </>
            ) : (
              <>
                Are you sure you want to delete these {dealNames.length} deals?
                <br />
                <span style={{ color: 'var(--color-text-tertiary)', fontSize: 12 }}>
                  This action cannot be undone.
                </span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? <LoadingSpinner size="sm" /> : allSelected ? `Delete ${totalCount?.toLocaleString() ?? 'All'}` : isSingle ? 'Delete' : `Delete ${dealNames.length}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
