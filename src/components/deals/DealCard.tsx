import { DealScoreBadge } from './DealScoreBadge'

interface DealCardProps {
  deal: {
    id: string
    deal_name: string | null
    address: string | null
    city: string | null
    state: string | null
    unit_count: number | null
    year_built: number | null
    stage: string
    score: string | null
    property_type: string | null
    building_class: string | null
  }
  onClick?: () => void
}

export function DealCard({ deal, onClick }: DealCardProps) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-slate-900">{deal.deal_name ?? 'Untitled'}</h3>
        <DealScoreBadge score={deal.score} />
      </div>
      <p className="text-sm text-slate-500">{[deal.address, deal.city, deal.state].filter(Boolean).join(', ') || 'No address'}</p>
      <div className="flex items-center gap-3 mt-3 text-xs text-slate-500">
        {deal.unit_count && <span>{deal.unit_count} units</span>}
        {deal.year_built && <span>Built {deal.year_built}</span>}
        {deal.property_type && <span>{deal.property_type}</span>}
        {deal.building_class && <span>Class {deal.building_class}</span>}
      </div>
      <div className="mt-3">
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
          {deal.stage.replace(/_/g, ' ')}
        </span>
      </div>
    </div>
  )
}
