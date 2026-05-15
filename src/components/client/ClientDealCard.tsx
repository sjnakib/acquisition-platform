import { DealScoreBadge } from '@/components/deals/DealScoreBadge'

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
 <div className=" rounded-xl border p-5">
 <div className="flex items-start justify-between mb-2">
 <h3 className="font-semibold ">{deal.deal_name ?? 'Untitled'}</h3>
 <DealScoreBadge score={deal.score} />
 </div>
 <p className="text-sm ">{[deal.address, deal.city, deal.state].filter(Boolean).join(', ') || 'No address'}</p>
 <div className="flex items-center gap-3 mt-3 text-xs ">
 {deal.unit_count && <span>{deal.unit_count} units</span>}
 {deal.year_built && <span>Built {deal.year_built}</span>}
 </div>
 <div className="mt-3">
 <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ">
 {deal.stage.replace(/_/g, ' ')}
 </span>
 </div>
 </div>
 )
}
