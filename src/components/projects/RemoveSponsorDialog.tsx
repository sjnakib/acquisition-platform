'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

interface RemoveSponsorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sponsorName: string | null
  sponsorEmail: string | null
  onConfirm: () => Promise<void>
}

export function RemoveSponsorDialog({ open, onOpenChange, sponsorName, sponsorEmail, onConfirm }: RemoveSponsorDialogProps) {
  const [removing, setRemoving] = useState(false)

  const handleRemove = async () => {
    setRemoving(true)
    try {
      await onConfirm()
      toast.success('Sponsor removed')
      onOpenChange(false)
    } catch {
      toast.error('Failed to remove sponsor')
    } finally {
      setRemoving(false)
    }
  }

  const label = sponsorName ?? sponsorEmail ?? 'this sponsor'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]" style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-surface-2)' }}>
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--color-text-primary)' }}>Remove Sponsor</DialogTitle>
          <DialogDescription style={{ color: 'var(--color-text-secondary)' }}>
            Are you sure you want to remove{' '}
            <strong style={{ color: 'var(--color-text-primary)' }}>{label}</strong>
            ? They will lose access to this project.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={removing}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleRemove}
            disabled={removing}
          >
            {removing ? <LoadingSpinner size="sm" /> : 'Remove'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
