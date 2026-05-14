'use client'

import { useState, useEffect } from 'react'
import { Building2 } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'

interface Deal {
  id: string;
  deal_name: string;
  address: string;
  city: string;
  state: string;
  unit_count: number;
  year_built: number;
  score: string;
}

export default function ClientOverviewPage() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/deals')
      .then((r) => r.json())
      .then((data) => setDeals(data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <PageHeader title="Active Deals" description="Properties your team is actively pursuing" />
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-32 bg-slate-100 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : deals.length === 0 ? (
        <EmptyState icon={Building2} title="No active deals yet" description="Your team will notify you when deals are ready." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {deals.map((deal) => (
            <div key={deal.id} className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-900">{deal.deal_name}</h3>
              <p className="text-sm text-slate-500 mt-1">{[deal.address, deal.city, deal.state].filter(Boolean).join(', ')}</p>
              <div className="flex items-center gap-3 mt-3 text-xs text-slate-500">
                {deal.unit_count && <span>{deal.unit_count} units</span>}
                {deal.year_built && <span>Built {deal.year_built}</span>}
              </div>
              {deal.score && (
                <span className={`inline-flex mt-2 px-2 py-0.5 rounded text-xs font-medium border ${
                  deal.score === 'very_good' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-teal-100 text-teal-800 border-teal-200'
                }`}>
                  {deal.score.replace(/_/g, ' ')}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
