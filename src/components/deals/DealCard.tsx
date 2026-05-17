import { DealScoreBadge } from './DealScoreBadge'

interface DealCardProps {
  deal: {
    id: string
    deal_name: string | null
    unit_count: number | null
    stage: string
    score: string | null
  }
  onClick?: () => void
}

export function DealCard({ deal, onClick }: DealCardProps) {
  return (
    <div
      onClick={onClick}
      className="rounded-xl border p-5 hover:shadow-md transition-shadow cursor-pointer"
      style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-surface-2)' }}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{deal.deal_name ?? 'Untitled'}</h3>
        <DealScoreBadge score={deal.score} />
      </div>
      <div className="flex items-center gap-3 mt-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        {deal.unit_count ? <span>{deal.unit_count} units</span> : null}
      </div>
      <div className="mt-3">
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium" style={{ background: 'var(--color-surface-1)', color: 'var(--color-text-secondary)' }}>
          {deal.stage.replace(/_/g, ' ')}
        </span>
      </div>
    </div>
  )
}
