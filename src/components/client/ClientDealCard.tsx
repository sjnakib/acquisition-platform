import { DealScoreBadge } from '@/components/deals/DealScoreBadge'
import { Badge } from '@/components/ui/badge'

interface ClientDealCardProps {
  deal: {
    id: string
    score: string | null
    stage: string
    deal_fields?: { value: string | null; field_definitions: { key: string; label: string; data_type: string } | null }[] | null
  }
}

function getField(deal: ClientDealCardProps['deal'], key: string): string {
  const f = deal.deal_fields?.find((df) => df?.field_definitions?.key === key)
  return f?.value ?? ''
}

export function ClientDealCard({ deal }: ClientDealCardProps) {
  return (
    <div className="rounded-xl border p-5" style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-surface-2)', boxShadow: 'var(--shadow-xs)' }}>
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans)' }}>{getField(deal, 'deal_name') || 'Untitled'}</h3>
        <DealScoreBadge score={deal.score} />
      </div>
      <div className="flex items-center gap-3 mt-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        {getField(deal, 'unit_count') ? <span>{getField(deal, 'unit_count')} units</span> : null}
      </div>
      <div className="mt-3">
        <Badge variant="neutral" size="sm">{deal.stage.replace(/_/g, ' ')}</Badge>
      </div>
    </div>
  )
}
