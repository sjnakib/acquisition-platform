import { Badge } from '@/components/ui/badge'

interface DealScoreBadgeProps {
  score: string | null | undefined
}

const variantMap: Record<string, 'score-vg' | 'score-g' | 'score-b' | 'score-vb'> = {
  very_good: 'score-vg',
  good: 'score-g',
  bad: 'score-b',
  very_bad: 'score-vb',
}

const labelMap: Record<string, string> = {
  very_good: 'Very Good',
  good: 'Good',
  bad: 'Bad',
  very_bad: 'Very Bad',
}

export function DealScoreBadge({ score }: DealScoreBadgeProps) {
  if (!score) {
    return <Badge variant="neutral">Unscored</Badge>
  }

  const variant = variantMap[score]
  if (!variant) return null

  return <Badge variant={variant}>{labelMap[score] ?? score}</Badge>
}
