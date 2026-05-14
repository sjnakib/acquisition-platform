'use client'

import { useState, useEffect } from 'react'

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
    await fetch(`/api/deals/${dealId}/documents`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
  }

  if (loading) return <div className="text-sm text-slate-400">Loading...</div>

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input type="checkbox" checked={docs.pl_collected ?? false} onChange={(e) => updateDoc('pl_collected', e.target.checked)} className="rounded" />
        <label className="text-sm text-slate-700">P&L Collected</label>
        <input type="text" value={docs.pl_period ?? ''} onChange={(e) => updateDoc('pl_period', e.target.value)} placeholder="Period" className="ml-2 h-7 rounded border border-slate-300 px-2 text-xs" />
      </div>
      <div className="flex items-center gap-3">
        <input type="checkbox" checked={docs.rent_roll_collected ?? false} onChange={(e) => updateDoc('rent_roll_collected', e.target.checked)} className="rounded" />
        <label className="text-sm text-slate-700">Rent Roll Collected</label>
        <input type="date" value={docs.rent_roll_as_of ?? ''} onChange={(e) => updateDoc('rent_roll_as_of', e.target.value)} className="ml-2 h-7 rounded border border-slate-300 px-2 text-xs" />
      </div>
      <div className="flex items-center gap-3">
        <input type="checkbox" checked={docs.om_collected ?? false} onChange={(e) => updateDoc('om_collected', e.target.checked)} className="rounded" />
        <label className="text-sm text-slate-700">Offering Memorandum</label>
      </div>
      <div className="flex items-center gap-3">
        <input type="checkbox" checked={docs.tax_bill_collected ?? false} onChange={(e) => updateDoc('tax_bill_collected', e.target.checked)} className="rounded" />
        <label className="text-sm text-slate-700">Tax Bill</label>
      </div>
      <div className="flex items-center gap-3">
        <input type="checkbox" checked={docs.capex_collected ?? false} onChange={(e) => updateDoc('capex_collected', e.target.checked)} className="rounded" />
        <label className="text-sm text-slate-700">CapEx Schedule</label>
      </div>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <input type="checkbox" checked={docs[`market_report_${i}`] as boolean ?? false} onChange={(e) => updateDoc(`market_report_${i}`, e.target.checked)} className="rounded" />
          <label className="text-sm text-slate-700">Market Report {i}</label>
        </div>
      ))}
    </div>
  )
}
