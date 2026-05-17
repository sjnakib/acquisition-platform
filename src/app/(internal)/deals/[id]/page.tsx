'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Building2 } from 'lucide-react'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'

interface Deal {
  deal_name: string | null;
  unit_count: number | null;
}

export default function DealDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [deal, setDeal] = useState<Deal | null>(null)
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
      <button onClick={() => router.push('/deals')} className="flex items-center gap-1 text-sm mb-4" style={{ color: 'var(--color-text-tertiary)' }}>
        <ArrowLeft className="h-4 w-4" /> Back to Deals
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>{deal.deal_name ?? 'Untitled Deal'}</h1>
          {deal.unit_count ? <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{deal.unit_count} units</p> : null}
        </div>
      </div>

      <div className="border-b mb-6" style={{ borderColor: 'var(--color-surface-2)' }}>
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab.toLowerCase().replace(/\s+/g, '_'))}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.toLowerCase().replace(/\s+/g, '_')
                  ? 'border-current'
                  : 'border-transparent'
              }`}
              style={{
                color: activeTab === tab.toLowerCase().replace(/\s+/g, '_') ? 'var(--accent)' : 'var(--color-text-tertiary)',
              }}
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
