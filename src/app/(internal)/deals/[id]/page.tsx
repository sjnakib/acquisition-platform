'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Building2 } from 'lucide-react'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { useDeal } from '@/lib/hooks/useDeal'

interface Deal {
  deal_fields?: { value: string | null; field_definitions: { key: string; label: string; data_type: string } | null }[] | null
}

export default function DealDetailPage() {
  const params = useParams()
  const router = useRouter()
  const dealId = params.id as string
  const { data: deal, isLoading: loading } = useDeal<Deal>(dealId)
  const [activeTab, setActiveTab] = useState('overview')

  const tabs = ['Overview', 'Contacts', 'Outreach', 'Deal Room', 'Underwriting', 'LOI', 'Call Brief']

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

  const dealFields = deal.deal_fields ?? []
  const addrField = dealFields.find((f) => f.field_definitions?.key === 'address')
  const dealName = addrField?.value ?? 'Untitled Deal'

  const unitsField = dealFields.find((f) => f.field_definitions?.key === 'unit_count')
  const unitCount = unitsField?.value ? parseInt(unitsField.value, 10) : null

  return (
    <div>
      <button onClick={() => router.push('/deals')} className="flex items-center gap-1 text-sm mb-4" style={{ color: 'var(--color-text-tertiary)' }}>
        <ArrowLeft className="h-4 w-4" /> Back to Deals
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>{dealName}</h1>
          {unitCount ? <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{unitCount} units</p> : null}
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

      <div className="rounded-xl border p-6" style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-surface-2)' }}>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Deal detail tabs coming soon.</p>
        <pre className="mt-4 text-xs overflow-auto" style={{ color: 'var(--color-text-tertiary)' }}>{JSON.stringify(deal, null, 2)}</pre>
      </div>
    </div>
  )
}
