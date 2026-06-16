'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

interface DisconnectGoogleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  googleEmail: string | null
  onConfirm: () => Promise<void>
}

export function DisconnectGoogleDialog({
  open,
  onOpenChange,
  googleEmail,
  onConfirm,
}: DisconnectGoogleDialogProps) {
  const [disconnecting, setDisconnecting] = useState(false)

  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch {
      // Error handled by parent/hook toast
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]" style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-surface-2)' }}>
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--color-text-primary)' }}>Disconnect Google Account</DialogTitle>
          <DialogDescription style={{ color: 'var(--color-text-secondary)' }}>
            Are you sure you want to disconnect <strong style={{ color: 'var(--color-text-primary)' }}>{googleEmail ?? 'your Google account'}</strong> from this project?
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-[var(--color-danger-border)] p-4 bg-[var(--color-danger-bg)]/10 my-2 flex gap-3 items-start">
          <AlertTriangle size={18} className="text-[var(--color-danger-text)] flex-shrink-0 mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-[var(--color-danger-text)]">
              Warning: Service Interruption
            </span>
            <p className="text-[11px] leading-relaxed text-[var(--color-danger-text)]">
              All ongoing email campaigns, incoming response tracking, and Google Drive file managers for this project will stop functioning immediately.
            </p>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={disconnecting}
            className="h-9 text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleDisconnect}
            disabled={disconnecting}
            style={{ background: 'var(--color-danger-solid)', color: 'var(--color-text-inverse)' }}
            className="h-9 text-xs font-semibold hover:opacity-90"
          >
            {disconnecting ? (
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
