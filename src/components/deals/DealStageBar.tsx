import { Check, XCircle } from 'lucide-react'

interface DealStageBarProps {
  stage: string
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

export function DealStageBar({ stage, isArchived, archiveReason }: DealStageBarProps) {
  if (stage === 'failed') {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border" style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger-text)', borderColor: 'var(--color-danger-border)' }}>
          <XCircle className="h-3 w-3" /> Failed
        </span>
      </div>
    )
  }

  if (isArchived || stage === 'archived') {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border" style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger-text)', borderColor: 'var(--color-danger-border)' }}>
          Archived
        </span>
        {archiveReason && <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{archiveReason}</span>}
      </div>
    )
  }

  const currentIndex = STAGES.indexOf(stage)

  return (
    <div className="hidden sm:flex items-center gap-0">
      {STAGES.map((s, i) => {
        const isCompleted = i < currentIndex
        const isActive = i === currentIndex

        return (
          <div key={s} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium border-2 transition-colors"
                style={{
                  background: isCompleted ? 'var(--color-success-solid)' : isActive ? 'var(--accent)' : 'transparent',
                  borderColor: isCompleted ? 'var(--color-success-solid)' : isActive ? 'var(--accent)' : 'var(--color-surface-3)',
                  color: isCompleted || isActive ? '#FFFFFF' : 'var(--color-text-tertiary)',
                }}
              >
                {isCompleted ? <Check className="h-3 w-3" /> : i + 1}
              </div>
              <span
                className="text-[10px] mt-1 whitespace-nowrap"
                style={{
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'var(--color-accent-muted)' : isCompleted ? 'var(--color-success-text)' : 'var(--color-text-tertiary)',
                }}
              >
                {STAGE_LABELS[s] ?? s}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div
                className="w-8 h-0.5 mx-1 mb-5"
                style={{ background: i < currentIndex ? 'var(--color-success-solid)' : 'var(--color-surface-3)' }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
