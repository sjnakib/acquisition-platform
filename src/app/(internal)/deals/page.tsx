'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Building2 } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { formatDate } from '@/lib/utils'

interface Deal {
  id: string
  deal_name: string | null
  address: string | null
  city: string | null
  state: string | null
  unit_count: number | null
  stage: string
  score: string | null
  created_at: string
  campaigns: { name: string; market: string } | null
}

export default function DealsPage() {
  const router = useRouter()
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/deals')
      .then((res) => res.json())
      .then((data) => setDeals(data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div>
        <PageHeader title="Deals" description="Manage your property pipeline" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-slate-100 animate-pulse rounded-md" />
          ))}
        </div>
      </div>
    )
  }

  const stageColors: Record<string, string> = {
    lead: 'bg-slate-100 text-slate-700',
    outreach: 'bg-blue-100 text-blue-700',
    response: 'bg-teal-100 text-teal-700',
    document_collection: 'bg-amber-100 text-amber-700',
    underwritability_review: 'bg-orange-100 text-orange-700',
    underwriting: 'bg-purple-100 text-purple-700',
    scored: 'bg-green-100 text-green-700',
    call_scheduled: 'bg-indigo-100 text-indigo-700',
    loi: 'bg-rose-100 text-rose-700',
    closed: 'bg-emerald-100 text-emerald-700',
    archived: 'bg-red-100 text-red-700',
  }

  const scoreColors: Record<string, string> = {
    very_good: 'bg-green-100 text-green-800 border-green-200',
    good: 'bg-teal-100 text-teal-800 border-teal-200',
    bad: 'bg-orange-100 text-orange-800 border-orange-200',
    very_bad: 'bg-red-100 text-red-800 border-red-200',
  }

  if (deals.length === 0) {
    return (
      <div>
        <PageHeader title="Deals" description="Manage your property pipeline" />
        <EmptyState
          icon={Building2}
          title="No deals found"
          description="Import properties from CoStar to get started"
          action={{ label: 'Import from CoStar', onClick: () => router.push('/import') }}
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Deals" description={`${deals.length} deals in pipeline`} />
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Property Name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Address</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Units</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Stage</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Score</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Campaign</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Date Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {deals.map((deal) => (
                <tr
                  key={deal.id}
                  onClick={() => router.push(`/deals/${deal.id}`)}
                  className="hover:bg-slate-50 cursor-pointer"
                >
                  <td className="px-4 py-3 font-medium text-slate-900 max-w-xs truncate">
                    {deal.deal_name ?? 'Untitled'}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-sm">
                    {[deal.address, deal.city, deal.state].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {deal.unit_count ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${stageColors[deal.stage] ?? 'bg-slate-100 text-slate-700'}`}>
                      {deal.stage.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {deal.score ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${scoreColors[deal.score] ?? ''}`}>
                        {deal.score.replace(/_/g, ' ')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500">Unscored</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{deal.campaigns?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500 text-sm">{formatDate(deal.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
