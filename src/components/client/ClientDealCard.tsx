import { DealScoreBadge } from '@/components/deals/DealScoreBadge'
import { Badge } from '@/components/ui/badge'

interface ClientDealCardProps {
  deal: {
    id: string
    deal_name: string | null
    address: string | null
    city: string | null
    state: string | null
    unit_count: number | null
    year_built: number | null
    score: string | null
    stage: string
  }
}

export function ClientDealCard({ deal }: ClientDealCardProps) {
  return (
    <div className="rounded-xl border p-5" style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-surface-2)', boxShadow: 'var(--shadow-xs)' }}>
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans)' }}>{deal.deal_name ?? 'Untitled'}</h3>
        <DealScoreBadge score={deal.score} />
      </div>
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{[deal.address, deal.city, deal.state].filter(Boolean).join(', ') || 'No address'}</p>
      <div className="flex items-center gap-3 mt-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        {deal.unit_count && <span>{deal.unit_count} units</span>}
        {deal.year_built && <span>Built {deal.year_built}</span>}
      </div>
      <div className="mt-3">
        <Badge variant="neutral" size="sm">{deal.stage.replace(/_/g, ' ')}</Badge>
      </div>
    </div>
  )
}
