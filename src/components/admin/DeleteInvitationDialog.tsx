'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

interface InvitationInfo {
  id: string
  email: string
}

interface DeleteInvitationDialogProps {
  invitation: InvitationInfo | null
  onClose: () => void
  onDeleted: () => void
}

export function DeleteInvitationDialog({ invitation, onClose, onDeleted }: DeleteInvitationDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const open = invitation !== null

  async function handleDelete() {
    if (!invitation) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/admin/invitations/${invitation.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to delete invitation')
      }

      onDeleted()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  function handleOpenChange(open: boolean) {
    if (!open && !loading) {
      setError(null)
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent style={{ maxWidth: 420 }}>
        <DialogHeader>
          <DialogTitle>Delete Invitation</DialogTitle>
          <DialogDescription>
            This invitation link will be permanently deleted. The recipient will
            no longer be able to use it to create an account.
          </DialogDescription>
        </DialogHeader>

        {invitation && (
          <div className="space-y-2 py-2">
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {invitation.email}
            </p>
          </div>
        )}

        {error && (
          <div
            className="text-[13px] rounded-lg p-3 font-medium"
            style={{
              background: 'var(--color-danger-bg)',
              border: '1px solid var(--color-danger-border)',
              color: 'var(--color-danger-text)',
            }}
          >
            {error}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            style={{
              background: 'var(--color-danger-bg)',
              color: 'var(--color-danger-text)',
              borderColor: 'var(--color-danger-border)',
            }}
          >
            {loading ? <><LoadingSpinner size="sm" /> Deleting...</> : 'Delete Invitation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
