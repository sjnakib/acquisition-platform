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

 if (loading) return <div className="text-sm text-slate-400">Loading...</div>

 if (!loi) {
 return (
 <div className="text-center py-8">
 <p className="text-sm text-slate-500 mb-3">No LOI submitted</p>
 <button onClick={createLOI} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">
 Create LOI
 </button>
 </div>
 )
 }

 return (
 <div className="space-y-3">
 <div className="text-sm">
 <span className="text-slate-500">Submitted: </span>
 <span className="font-medium">{loi.submitted_at ?? '—'}</span>
 </div>
 <div className="text-sm">
 <span className="text-slate-500">Offered Price: </span>
 <span className="font-medium">{loi.offered_price ? `$${loi.offered_price.toLocaleString()}` : '—'}</span>
 </div>
 <div className="text-sm">
 <span className="text-slate-500">Outcome: </span>
 <span className="font-medium">{loi.outcome?.replace(/_/g, ' ') ?? 'In Progress'}</span>
 </div>
 </div>
 )
}
