'use client'

import { useState } from 'react'
import { AlertTriangle, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

interface GoogleReconnectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reconnectUrl: string
  onDismiss?: () => void
  title?: string
  description?: string
  isSystem?: boolean
}

export function GoogleReconnectDialog({
  open,
  onOpenChange,
  reconnectUrl,
  onDismiss,
  title = 'Google Connection Expired',
  description,
  isSystem = false,
}: GoogleReconnectDialogProps) {
  const [navigating, setNavigating] = useState(false)

  const handleReconnect = () => {
    setNavigating(true)
    const returnTo = window.location.pathname + window.location.search
    const separator = reconnectUrl.includes('?') ? '&' : '?'
    window.location.href = `${reconnectUrl}${separator}returnTo=${encodeURIComponent(returnTo)}`
  }

  const handleDismiss = () => {
    onOpenChange(false)
    onDismiss?.()
  }

  const defaultDescription = isSystem
    ? 'The system-wide Google connection has expired. System emails (invitations, notifications) will fail until reconnected.'
    : 'Your Google account connection has expired. Email and Drive features will not work until you reconnect.'

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleDismiss()
    }}>
      <DialogContent style={{ maxWidth: 440 }}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description ?? defaultDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-[var(--color-warning-border)] p-4 my-2 flex gap-3 items-start"
          style={{ background: 'color-mix(in srgb, var(--color-warning-bg) 10%, transparent)' }}>
          <AlertTriangle size={18} className="text-[var(--color-warning-text)] flex-shrink-0 mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-[var(--color-warning-text)]">
              Action Required
            </span>
            <p className="text-[11px] leading-relaxed text-[var(--color-warning-text)]">
              Google requires re-authorization. Your existing data is preserved.
            </p>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleDismiss}
            disabled={navigating}
            className="h-9 text-xs"
          >
            {onDismiss ? 'Later' : 'Dismiss'}
          </Button>
          <Button
            type="button"
            onClick={handleReconnect}
            disabled={navigating}
            style={{ background: 'var(--accent)', color: 'var(--color-text-inverse)' }}
            className="h-9 text-xs font-semibold"
          >
            {navigating ? (
              <span className="flex items-center gap-1.5">
                <LoadingSpinner size="sm" />
                Redirecting...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <ExternalLink size={14} />
                Reconnect Now
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
