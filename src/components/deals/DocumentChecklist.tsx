'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'

interface DocumentChecklistProps {
  dealId: string
}

interface Documents {
  pl_collected?: boolean;
  pl_period?: string;
  rent_roll_collected?: boolean;
  rent_roll_as_of?: string;
  om_collected?: boolean;
  tax_bill_collected?: boolean;
  capex_collected?: boolean;
  [key: string]: boolean | string | undefined;
}

export function DocumentChecklist({ dealId }: DocumentChecklistProps) {
  const [docs, setDocs] = useState<Documents>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/deals/${dealId}/documents`)
      .then((r) => r.json())
      .then((data) => setDocs(data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [dealId])

  async function updateDoc(field: string, value: string | boolean) {
    const updated = { ...docs, [field]: value }
    setDocs(updated)
    const res = await fetch(`/api/deals/${dealId}/documents`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
    if (!res.ok) {
      toast.error('Failed to update document')
      setDocs(docs)
    }
  }

  if (loading) return <div className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>Loading...</div>

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input type="checkbox" checked={docs.pl_collected ?? false} onChange={(e) => updateDoc('pl_collected', e.target.checked)} className="rounded-sm" />
        <label className="text-sm" style={{ color: 'var(--color-text-primary)' }}>P&L Collected</label>
        <input type="text" value={docs.pl_period ?? ''} onChange={(e) => updateDoc('pl_period', e.target.value)} placeholder="Period" className="ml-2 h-7 rounded-sm border px-2 text-xs" style={{ borderColor: 'var(--color-surface-3)' }} />
      </div>
      <div className="flex items-center gap-3">
        <input type="checkbox" checked={docs.rent_roll_collected ?? false} onChange={(e) => updateDoc('rent_roll_collected', e.target.checked)} className="rounded-sm" />
        <label className="text-sm" style={{ color: 'var(--color-text-primary)' }}>Rent Roll Collected</label>
        <input type="date" value={docs.rent_roll_as_of ?? ''} onChange={(e) => updateDoc('rent_roll_as_of', e.target.value)} className="ml-2 h-7 rounded-sm border px-2 text-xs" style={{ borderColor: 'var(--color-surface-3)' }} />
      </div>
      <div className="flex items-center gap-3">
        <input type="checkbox" checked={docs.om_collected ?? false} onChange={(e) => updateDoc('om_collected', e.target.checked)} className="rounded-sm" />
        <label className="text-sm" style={{ color: 'var(--color-text-primary)' }}>Offering Memorandum</label>
      </div>
      <div className="flex items-center gap-3">
        <input type="checkbox" checked={docs.tax_bill_collected ?? false} onChange={(e) => updateDoc('tax_bill_collected', e.target.checked)} className="rounded-sm" />
        <label className="text-sm" style={{ color: 'var(--color-text-primary)' }}>Tax Bill</label>
      </div>
      <div className="flex items-center gap-3">
        <input type="checkbox" checked={docs.capex_collected ?? false} onChange={(e) => updateDoc('capex_collected', e.target.checked)} className="rounded-sm" />
        <label className="text-sm" style={{ color: 'var(--color-text-primary)' }}>CapEx Schedule</label>
      </div>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <input type="checkbox" checked={docs[`market_report_${i}`] as boolean ?? false} onChange={(e) => updateDoc(`market_report_${i}`, e.target.checked)} className="rounded-sm" />
          <label className="text-sm" style={{ color: 'var(--color-text-primary)' }}>Market Report {i}</label>
        </div>
      ))}
    </div>
  )
}
