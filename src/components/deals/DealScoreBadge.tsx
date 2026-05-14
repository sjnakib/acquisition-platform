import { cn } from '@/lib/utils'

interface DealScoreBadgeProps {
  score: string | null | undefined
}

const scoreConfig: Record<string, { label: string; className: string }> = {
  very_good: { label: 'Very Good', className: 'bg-green-100 text-green-800 border-green-200' },
  good: { label: 'Good', className: 'bg-teal-100 text-teal-800 border-teal-200' },
  bad: { label: 'Bad', className: 'bg-orange-100 text-orange-800 border-orange-200' },
  very_bad: { label: 'Very Bad', className: 'bg-red-100 text-red-800 border-red-200' },
}

export function DealScoreBadge({ score }: DealScoreBadgeProps) {
  if (!score) {
    return <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500">Unscored</span>
  }

  const config = scoreConfig[score]
  if (!config) return null

  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border', config.className)}>
      {config.label}
    </span>
  )
}
