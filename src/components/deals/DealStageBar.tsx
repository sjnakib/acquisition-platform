'use client'

import { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, XCircle, Loader2, Archive, ArchiveRestore, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { canTransition, type DealStage } from '@/lib/stage-machine'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

interface DealStageBarProps {
  dealId?: string
  stage: string
  onStageChange?: (newStage: string) => void
  isArchived?: boolean
  archiveReason?: string | null
}

const STAGES = [
  'lead', 'outreach', 'response', 'underwriting', 'loi', 'closed',
]

const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead',
  outreach: 'Outreach',
  response: 'Response',
  underwriting: 'Underwriting',
  loi: 'LOI',
  closed: 'Closed',
  failed: 'Failed',
  archived: 'Archived',
}

export function DealStageBar({ dealId, stage, onStageChange }: DealStageBarProps) {
  const queryClient = useQueryClient()
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const [showFailConfirm, setShowFailConfirm] = useState(false)

  const stageMutation = useMutation({
    mutationFn: async (targetStage: string) => {
      const res = await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: targetStage }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Failed to update stage')
      }
      return targetStage
    },
    onSuccess: (targetStage) => {
      toast.success(`Stage updated to ${STAGE_LABELS[targetStage] ?? targetStage}`)
      onStageChange?.(targetStage)
      queryClient.invalidateQueries({ queryKey: ['deal', dealId!] })
      queryClient.invalidateQueries({ queryKey: ['deals'] })
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to update stage'),
  })

  const handleStageClick = useCallback((targetStage: string) => {
    if (!dealId || !onStageChange || stageMutation.isPending) return

    const currentStage = stage as DealStage
    const target = targetStage as DealStage

    const check = canTransition(currentStage, target)
    if (!check.ok) {
      toast.error(check.reason ?? `Cannot transition from ${currentStage} to ${target}`)
      return
    }

    stageMutation.mutate(targetStage)
  }, [dealId, stage, onStageChange, stageMutation])

  const currentIndex = STAGES.indexOf(stage)
  const isPipelineActive = currentIndex !== -1

  // Calculate width percentage of active progress bar
  const activePercent = isPipelineActive ? (currentIndex / (STAGES.length - 1)) * 100 : 0

  return (
    <div className="flex items-center gap-5 select-none flex-wrap">
      {/* Pipeline Container */}
      <div 
        className={`relative flex items-center justify-between w-80 h-10 transition-opacity duration-300 ${
          !isPipelineActive ? 'opacity-50 pointer-events-none' : ''
        }`}
      >
        {/* Track Container */}
        <div className="absolute top-[11px] left-3 right-3 h-[2px] bg-[var(--color-surface-2)] z-0 rounded-full">
          {/* Animated Active Progress Fill */}
          <div 
            className="h-full bg-[var(--color-success-solid)] transition-all duration-500 ease-in-out rounded-full"
            style={{ width: `${activePercent}%` }}
          />
        </div>

        {/* Circles */}
        {STAGES.map((s, i) => {
          const isCompleted = i < currentIndex
          const isActive = i === currentIndex
          const label = STAGE_LABELS[s] ?? s
          
          const isClickable = !!(dealId && onStageChange && !stageMutation.isPending && stage !== s)
          
          // Check if transition is valid
          const check = isClickable ? canTransition(stage as DealStage, s as DealStage) : { ok: false }
          const isDisabledTransition = !!(isClickable && !check.ok)

          return (
            <div key={s} className="relative z-10 flex flex-col items-center">
              <button
                type="button"
                onClick={() => isClickable && !isDisabledTransition && handleStageClick(s)}
                disabled={!isClickable || isDisabledTransition}
                className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all duration-300 relative group ${
                  isClickable && !isDisabledTransition ? 'cursor-pointer hover:scale-110' : 'cursor-default'
                }`}
                style={{
                  background: isCompleted 
                    ? 'var(--color-success-solid)' 
                    : isActive 
                      ? 'var(--color-surface-0)' 
                      : 'var(--color-surface-0)',
                  borderColor: isCompleted 
                    ? 'var(--color-success-solid)' 
                    : isActive 
                      ? 'var(--color-accent)' 
                      : 'var(--color-surface-3)',
                  color: isCompleted 
                    ? 'var(--color-text-inverse)' 
                    : isActive 
                      ? 'var(--color-accent)' 
                      : 'var(--color-text-tertiary)',
                  boxShadow: isActive 
                    ? '0 0 0 3px var(--color-accent-bg), var(--shadow-sm)' 
                    : undefined,
                  transform: isActive ? 'scale(1.05)' : undefined,
                }}
                title={isDisabledTransition ? `${check.reason}` : `Transition to ${label}`}
              >
                {stageMutation.isPending && stageMutation.variables === s ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : isCompleted ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <span className="text-[10px] font-bold">{i + 1}</span>
                )}

                {/* Pulsing glow ring for active circle */}
                {isActive && (
                  <span className="absolute -inset-0.5 rounded-full border border-[var(--color-accent)] opacity-40 animate-ping pointer-events-none" />
                )}

                {/* Tooltip on hover */}
                {isClickable && !isDisabledTransition && (
                  <span 
                    className="absolute bottom-full mb-2 hidden group-hover:block bg-[var(--color-surface-1)] text-[var(--color-text-primary)] text-[10px] font-medium px-2 py-1 rounded border shadow-sm whitespace-nowrap z-50 transition-opacity duration-150"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    Transition to {label}
                  </span>
                )}
                {isDisabledTransition && (
                  <span 
                    className="absolute bottom-full mb-2 hidden group-hover:block bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] text-[10px] font-medium px-2 py-1 rounded border shadow-sm whitespace-normal max-w-[150px] text-center z-50 transition-opacity duration-150"
                    style={{ borderColor: 'var(--color-danger-border)' }}
                  >
                    {check.reason}
                  </span>
                )}
              </button>

              <span
                className="text-[9px] mt-1 whitespace-nowrap select-none transition-colors duration-300"
                style={{
                  fontWeight: isActive ? 600 : 400,
                  color: isActive 
                    ? 'var(--color-accent-muted)' 
                    : isCompleted 
                      ? 'var(--color-success-text)' 
                      : 'var(--color-text-tertiary)',
                }}
              >
                {label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Terminal State reactivators / contextual action buttons */}
      {dealId && onStageChange && (
        <div className="flex items-center gap-2">
          {/* Terminal state display */}
          {!isPipelineActive && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg border bg-[var(--color-surface-1)]" style={{ borderColor: 'var(--color-surface-3)' }}>
              <span 
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border select-none"
                style={{
                  background: 'var(--color-danger-bg)',
                  color: 'var(--color-danger-text)',
                  borderColor: 'var(--color-danger-border)',
                }}
              >
                {stage === 'failed' ? <XCircle className="h-3 w-3" /> : null}
                {STAGE_LABELS[stage] ?? stage}
              </span>
              <button
                type="button"
                onClick={() => handleStageClick(stage === 'failed' ? 'loi' : 'lead')}
                disabled={!!stageMutation.isPending}
                className="flex items-center gap-1.5 text-[11px] font-medium hover:underline transition-all duration-150 select-none cursor-pointer"
                style={{ color: 'var(--color-accent)' }}
              >
                {stageMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : stage === 'failed' ? (
                  <RotateCcw className="h-3.5 w-3.5" />
                ) : (
                  <ArchiveRestore className="h-3.5 w-3.5" />
                )}
                {stage === 'failed' ? 'Reopen Deal' : 'Unarchive'}
              </button>
            </div>
          )}

          {/* Archive Action (only allowed if prior to LOI stage) */}
          {isPipelineActive && ['lead', 'outreach', 'response', 'underwriting'].includes(stage) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowArchiveConfirm(true)}
              disabled={!!stageMutation.isPending}
              className="h-8 gap-1.5 text-xs transition-all duration-200"
              style={{ color: 'var(--color-text-secondary)', borderColor: 'var(--color-surface-3)' }}
            >
              <Archive className="h-3.5 w-3.5" />
              Archive
            </Button>
          )}

          {/* Mark Failed Action (only valid after LOI stage) */}
          {isPipelineActive && stage === 'loi' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFailConfirm(true)}
              disabled={!!stageMutation.isPending}
              className="h-8 gap-1.5 text-xs hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger-text)] hover:border-[var(--color-danger-border)] transition-all duration-200"
              style={{ color: 'var(--color-danger-text)', borderColor: 'var(--color-surface-3)' }}
            >
              <XCircle className="h-3.5 w-3.5" />
              Mark Failed
            </Button>
          )}
        </div>
      )}

      {/* Archive Confirmation Dialog */}
      <Dialog open={showArchiveConfirm} onOpenChange={setShowArchiveConfirm}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--color-text-primary)' }}>
              Archive Deal
            </DialogTitle>
            <DialogDescription style={{ color: 'var(--color-text-secondary)' }}>
              Are you sure you want to archive this deal? It will be removed from your active pipeline views, but you can unarchive it at any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={() => setShowArchiveConfirm(false)} disabled={!!stageMutation.isPending}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                await handleStageClick('archived')
                setShowArchiveConfirm(false)
              }}
              disabled={!!stageMutation.isPending}
              style={{ background: 'var(--color-accent)', color: 'var(--color-text-inverse)' }}
            >
              {stageMutation.isPending ? <LoadingSpinner size="sm" /> : 'Archive'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Failed Confirmation Dialog */}
      <Dialog open={showFailConfirm} onOpenChange={setShowFailConfirm}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--color-text-primary)' }}>
              Mark Deal as Failed
            </DialogTitle>
            <DialogDescription style={{ color: 'var(--color-text-secondary)' }}>
              Are you sure you want to mark this deal as failed? This will move it out of the active pipeline. You can reopen the deal later if needed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={() => setShowFailConfirm(false)} disabled={!!stageMutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await handleStageClick('failed')
                setShowFailConfirm(false)
              }}
              disabled={!!stageMutation.isPending}
            >
              {stageMutation.isPending ? <LoadingSpinner size="sm" /> : 'Mark Failed'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
