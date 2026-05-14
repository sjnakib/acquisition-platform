'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, Search, Settings2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { DealScoreBadge } from './DealScoreBadge'

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

interface DealTableProps {
  deals: Deal[]
  onArchive?: (id: string) => void
  onDelete?: (id: string) => void
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

export function DealTable({ deals, onArchive, onDelete }: DealTableProps) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  return (
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
              <th className="w-10 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {deals.map((deal) => (
              <tr
                key={deal.id}
                onClick={() => router.push(`/deals/${deal.id}`)}
                className="hover:bg-slate-50 cursor-pointer"
              >
                <td className="px-4 py-3 font-medium text-slate-900 max-w-xs truncate">{deal.deal_name ?? 'Untitled'}</td>
                <td className="px-4 py-3 text-slate-500 text-sm">
                  {[deal.address, deal.city, deal.state].filter(Boolean).join(', ') || '—'}
                </td>
                <td className="px-4 py-3 text-right text-slate-700">{deal.unit_count ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${stageColors[deal.stage] ?? 'bg-slate-100 text-slate-700'}`}>
                    {deal.stage.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <DealScoreBadge score={deal.score} />
                </td>
                <td className="px-4 py-3 text-slate-600">{deal.campaigns?.name ?? '—'}</td>
                <td className="px-4 py-3 text-slate-500 text-sm">{formatDate(deal.created_at)}</td>
                <td className="px-4 py-3 relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setMenuOpen(menuOpen === deal.id ? null : deal.id)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                  {menuOpen === deal.id && (
                    <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-md shadow-lg border border-slate-200 py-1 z-10">
                      <button
                        onClick={() => { router.push(`/deals/${deal.id}`); setMenuOpen(null) }}
                        className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        View
                      </button>
                      {onArchive && (
                        <button
                          onClick={() => { onArchive(deal.id); setMenuOpen(null) }}
                          className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                        >
                          Archive
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => { onDelete(deal.id); setMenuOpen(null) }}
                          className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
