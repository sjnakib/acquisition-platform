'use client'

import { useState, useEffect } from 'react'

interface UnderwritingFormProps {
  dealId: string
  unitCount?: number | null
}

interface Underwriting {
  underwritability?: string;
  asking_price?: number | null;
  irr_pct?: number | null;
}

export function UnderwritingForm({ dealId }: UnderwritingFormProps) {
  const [uw, setUw] = useState<Underwriting>({})
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

  if (loading) return <div className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>Loading...</div>

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>Underwritability</h3>
        <select
          value={uw.underwritability ?? ''}
          onChange={(e) => setUw({ ...uw, underwritability: e.target.value })}
          className="h-9 rounded-md border px-3 text-sm"
          style={{ borderColor: 'var(--color-surface-3)' }}
        >
          <option value="">Select...</option>
          <option value="underwritable">Underwritable</option>
          <option value="not_underwritable">Not Underwritable</option>
          <option value="maybe">Maybe</option>
        </select>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>Asking Price</h3>
        <input
          type="number"
          value={uw.asking_price ?? ''}
          onChange={(e) => setUw({ ...uw, asking_price: e.target.value ? Number(e.target.value) : null })}
          placeholder="$"
          className="h-9 rounded-md border px-3 text-sm w-full max-w-xs"
          style={{ borderColor: 'var(--color-surface-3)' }}
        />
      </div>

      <div>
        <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>IRR %</h3>
        <input
          type="number"
          step="0.001"
          value={uw.irr_pct ?? ''}
          onChange={(e) => setUw({ ...uw, irr_pct: e.target.value ? Number(e.target.value) : null })}
          className="h-9 rounded-md border px-3 text-sm w-full max-w-xs"
          style={{ borderColor: 'var(--color-surface-3)' }}
        />
      </div>

      <button
        onClick={handleSave}
        className="px-4 py-2 rounded-md text-sm transition-all duration-150 active:scale-[0.98]"
        style={{ background: 'var(--accent)', color: 'var(--color-text-inverse)' }}
      >
        Save Underwriting
      </button>
    </div>
  )
}
