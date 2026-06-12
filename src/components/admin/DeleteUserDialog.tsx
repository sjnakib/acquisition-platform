'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

interface UserInfo {
  id: string
  email: string | null
  full_name: string | null
  role: string
}

interface DeleteUserDialogProps {
  user: UserInfo | null
  onClose: () => void
  onDeleted: () => void
}

export function DeleteUserDialog({ user, onClose, onDeleted }: DeleteUserDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const open = user !== null

  async function handleDelete() {
    if (!user) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to delete user')
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
          <DialogTitle>Delete User</DialogTitle>
          <DialogDescription>
            This action cannot be undone. The user will be permanently removed from the system.
          </DialogDescription>
        </DialogHeader>

        {user && (
          <div className="space-y-2 py-2">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              {user.full_name ?? 'Unknown'}
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {user.email ?? 'No email'}
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              Role: {user.role}
            </p>
          </div>
        )}

        {error && (
          <div className="text-[13px] rounded-lg p-3 font-medium" style={{ background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)', color: 'var(--color-danger-text)' }}>
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
            style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger-text)', borderColor: 'var(--color-danger-border)' }}
          >
            {loading ? <><LoadingSpinner size="sm" /> Deleting...</> : 'Delete User'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
