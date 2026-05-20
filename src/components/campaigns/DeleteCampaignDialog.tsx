'use client'

import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface DeleteTarget {
  id: string
  name: string
}

interface Props {
  campaigns: DeleteTarget[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeleteCampaignDialog({ campaigns, open, onOpenChange }: Props) {
  const queryClient = useQueryClient()
  const isSingle = campaigns.length === 1

  const handleDelete = async () => {
    const results = await Promise.allSettled(
      campaigns.map((c) =>
        fetch(`/api/campaigns/${c.id}`, { method: 'DELETE' }).then((r) => {
          if (!r.ok) throw new Error(`Failed to delete ${c.name}`)
        })
      )
    )
    const failed = results.filter((r) => r.status === 'rejected')
    if (failed.length > 0) {
      toast.error(`Failed to delete ${failed.length} campaign(s)`)
    } else {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      toast.success(isSingle ? 'Campaign deleted' : `${campaigns.length} campaigns deleted`)
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>
            {isSingle ? 'Delete Campaign' : `Delete ${campaigns.length} Campaigns`}
          </DialogTitle>
          <DialogDescription style={{ color: 'var(--color-text-secondary)' }}>
            {isSingle ? (
              <>
                Are you sure you want to delete{' '}
                <strong style={{ color: 'var(--color-text-primary)' }}>{campaigns[0]?.name}</strong>?
                <br />
                <span style={{ color: 'var(--color-text-tertiary)', fontSize: 12 }}>
                  Deals in this campaign will be unlinked, not deleted.
                </span>
              </>
            ) : (
              <>
                Are you sure you want to delete these {campaigns.length} campaigns?
                <br />
                <span style={{ color: 'var(--color-text-tertiary)', fontSize: 12 }}>
                  Deals in these campaigns will be unlinked, not deleted.
                </span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
          >
            {isSingle ? 'Delete' : `Delete ${campaigns.length}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
