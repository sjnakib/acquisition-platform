'use client'

import { useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

interface DisconnectEmailDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
}

export function DisconnectEmailDialog({ open, onClose, onConfirm }: DisconnectEmailDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmText, setConfirmText] = useState('')

  async function handleConfirm() {
    if (confirmText !== 'DISCONNECT') return
    setLoading(true)
    setError(null)

    try {
      await onConfirm()
      setConfirmText('')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen && !loading) {
      setError(null)
      setConfirmText('')
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent style={{ maxWidth: 440 }}>
        <DialogHeader>
          <DialogTitle>Disconnect System Email</DialogTitle>
          <DialogDescription>
            You are about to disconnect the global Google integration.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-[var(--color-danger-border)] p-4 bg-[var(--color-danger-bg)]/10 my-2 flex gap-3 items-start">
          <ShieldAlert size={18} className="text-[var(--color-danger-text)] flex-shrink-0 mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-[var(--color-danger-text)]">Warning: High Impact Action</span>
            <p className="text-[11px] leading-relaxed text-[var(--color-danger-text)]">
              This action will disconnect the system-wide Gmail connection. All outgoing user invitations, system notifications, and automated follow-up emails will fail immediately.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-[11px] font-semibold text-[var(--color-text-secondary)]">
            Type <code className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]">DISCONNECT</code> to confirm:
          </label>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-full font-mono bg-[var(--color-canvas)] border-[var(--color-surface-2)] focus:ring-[var(--color-danger-text)] focus:border-[var(--color-danger-text)] text-xs h-9"
            placeholder="DISCONNECT"
            disabled={loading}
          />
        </div>

        {error && (
          <div className="text-[11px] rounded-lg p-3 font-medium border" style={{ background: 'var(--color-danger-bg)', borderColor: 'var(--color-danger-border)', color: 'var(--color-danger-text)' }}>
            {error}
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading} className="h-9 text-xs">
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={confirmText !== 'DISCONNECT' || loading}
            style={{
              background: confirmText === 'DISCONNECT' ? 'var(--color-danger-bg)' : 'var(--color-surface-2)',
              color: confirmText === 'DISCONNECT' ? 'var(--color-danger-text)' : 'var(--color-text-tertiary)',
              borderColor: confirmText === 'DISCONNECT' ? 'var(--color-danger-border)' : 'var(--color-surface-3)'
            }}
            className="h-9 text-xs font-medium border"
          >
            {loading ? (
              <span className="flex items-center gap-1.5">
                <LoadingSpinner size="sm" />
                Disconnecting...
              </span>
            ) : (
              'Disconnect Account'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
