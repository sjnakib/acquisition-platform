'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, ExternalLink, FolderOpen, Building2 } from 'lucide-react'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'

export default function DealDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [deal, setDeal] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  const tabs = ['Overview', 'Contacts', 'Outreach', 'Documents', 'Underwriting', 'LOI', 'Call Brief']

  useEffect(() => {
    if (!params.id) return
    fetch(`/api/deals/${params.id}`)
      .then((res) => res.json())
      .then((data) => setDeal(data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [params.id])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!deal) {
    return (
      <EmptyState
        icon={Building2}
        title="Deal not found"
        action={{ label: 'Back to Deals', onClick: () => router.push('/deals') }}
      />
    )
  }

  return (
    <div>
      <button onClick={() => router.push('/deals')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Deals
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{deal.deal_name ?? 'Untitled Deal'}</h1>
          <p className="text-sm text-slate-500">{[deal.address, deal.city, deal.state].filter(Boolean).join(', ') || 'No address'}</p>
        </div>
      </div>

      <div className="border-b border-slate-200 mb-6">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab.toLowerCase().replace(/\s+/g, '_'))}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.toLowerCase().replace(/\s+/g, '_')
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <p className="text-slate-500 text-sm">Deal detail tabs coming soon.</p>
        <pre className="mt-4 text-xs text-slate-400 overflow-auto">{JSON.stringify(deal, null, 2)}</pre>
      </div>
    </div>
  )
}
