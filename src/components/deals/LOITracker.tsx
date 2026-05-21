'use client'

import { useState, useEffect } from 'react'

interface LOITrackerProps {
  dealId: string
}

interface LOI {
  submitted_at: string | null;
  offered_price: number | null;
  outcome: string | null;
}

export function LOITracker({ dealId }: LOITrackerProps) {
  const [loi, setLoi] = useState<LOI | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/deals/${dealId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.loi_records) setLoi(data.loi_records)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [dealId])

  async function createLOI() {
    const res = await fetch('/api/loi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deal_id: dealId, submitted_at: new Date().toISOString().split('T')[0], offered_price: 0 }),
    })
    const data = await res.json()
    setLoi(data)
  }

  if (loading) return <div className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>Loading...</div>

  if (!loi) {
    return (
      <div className="text-center py-8">
        <p className="text-sm mb-3" style={{ color: 'var(--color-text-secondary)' }}>No LOI submitted</p>
        <button
          onClick={createLOI}
          className="px-4 py-2 rounded-md text-sm transition-all duration-150 active:scale-[0.98]"
          style={{ background: 'var(--accent)', color: 'var(--color-text-inverse)' }}
        >
          Create LOI
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="text-sm">
        <span style={{ color: 'var(--color-text-secondary)' }}>Submitted: </span>
        <span className="font-medium">{loi.submitted_at ?? '—'}</span>
      </div>
      <div className="text-sm">
        <span style={{ color: 'var(--color-text-secondary)' }}>Offered Price: </span>
        <span className="font-medium">{loi.offered_price ? `$${loi.offered_price.toLocaleString()}` : '—'}</span>
      </div>
      <div className="text-sm">
        <span style={{ color: 'var(--color-text-secondary)' }}>Outcome: </span>
        <span className="font-medium">{loi.outcome?.replace(/_/g, ' ') ?? 'In Progress'}</span>
      </div>
    </div>
  )
}
