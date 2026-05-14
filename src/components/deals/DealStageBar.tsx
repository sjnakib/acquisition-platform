import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DealStageBarProps {
  stage: string
  isArchived?: boolean
  archiveReason?: string | null
}

const STAGES = [
  'lead', 'outreach', 'response', 'document_collection', 'underwritability_review',
  'underwriting', 'scored', 'call_scheduled', 'loi', 'closed',
]

export function DealStageBar({ stage, isArchived, archiveReason }: DealStageBarProps) {
  if (isArchived) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
          Archived
        </span>
        {archiveReason && <span className="text-xs text-slate-500">{archiveReason}</span>}
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
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium border-2 transition-colors',
                  isCompleted && 'bg-green-500 border-green-500 text-white',
                  isActive && 'bg-blue-600 border-blue-600 text-white',
                  !isCompleted && !isActive && 'border-slate-300 text-slate-400'
                )}
              >
                {isCompleted ? <Check className="h-3 w-3" /> : i + 1}
              </div>
              <span
                className={cn(
                  'text-[10px] mt-1 whitespace-nowrap',
                  isActive && 'font-semibold text-blue-600',
                  isCompleted && 'text-green-600',
                  !isCompleted && !isActive && 'text-slate-400'
                )}
              >
                {s.replace(/_/g, ' ')}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div
                className={cn(
                  'w-8 h-0.5 mx-1 mb-5',
                  i < currentIndex ? 'bg-green-500' : 'bg-slate-200'
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
