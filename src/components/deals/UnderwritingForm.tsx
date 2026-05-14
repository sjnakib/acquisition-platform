'use client'

import { useState, useEffect } from 'react'

interface UnderwritingFormProps {
  dealId: string
  unitCount?: number | null
}

export function UnderwritingForm({ dealId, unitCount }: UnderwritingFormProps) {
  const [uw, setUw] = useState<any>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/deals/${dealId}`)
      .then((r) => r.json())
      .then((data) => setUw(data.underwriting ?? {}))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [dealId])

  async function handleSave() {
    await fetch('/api/underwriting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deal_id: dealId, ...uw }),
    })
  }

  if (loading) return <div className="text-sm text-slate-400">Loading...</div>

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-slate-700 mb-2">Underwritability</h3>
        <select
          value={uw.underwritability ?? ''}
          onChange={(e) => setUw({ ...uw, underwritability: e.target.value })}
          className="h-9 rounded-md border border-slate-300 px-3 text-sm"
        >
          <option value="">Select...</option>
          <option value="underwritable">Underwritable</option>
          <option value="not_underwritable">Not Underwritable</option>
          <option value="maybe">Maybe</option>
        </select>
      </div>

      <div>
        <h3 className="text-sm font-medium text-slate-700 mb-2">Asking Price</h3>
        <input
          type="number"
          value={uw.asking_price ?? ''}
          onChange={(e) => setUw({ ...uw, asking_price: e.target.value ? Number(e.target.value) : null })}
          placeholder="$"
          className="h-9 rounded-md border border-slate-300 px-3 text-sm w-full max-w-xs"
        />
      </div>

      <div>
        <h3 className="text-sm font-medium text-slate-700 mb-2">IRR %</h3>
        <input
          type="number"
          step="0.001"
          value={uw.irr_pct ?? ''}
          onChange={(e) => setUw({ ...uw, irr_pct: e.target.value ? Number(e.target.value) : null })}
          className="h-9 rounded-md border border-slate-300 px-3 text-sm w-full max-w-xs"
        />
      </div>

      <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">
        Save Underwriting
      </button>
    </div>
  )
}
