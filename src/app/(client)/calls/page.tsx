'use client'

import { useState, useEffect } from 'react'
import { Phone } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'

export default function ClientCallsPage() {
  const [calls, setCalls] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/calls')
      .then((r) => r.json())
      .then((data) => setCalls(data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const pending = calls.filter((c) => c.call_status === 'pending')
  const completed = calls.filter((c) => c.call_status !== 'pending')

  return (
    <div>
      <PageHeader title="Call Queue" subtitle="Review these deals before your call with the team" />
      {loading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => <div key={i} className="h-24 bg-slate-100 animate-pulse rounded-xl" />)}
        </div>
      ) : calls.length === 0 ? (
        <EmptyState icon={Phone} title="No calls queued yet" description="Your team will notify you." />
      ) : (
        <div className="space-y-6">
          <div className="space-y-3">
            {pending.map((call) => (
              <div key={call.id} className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">{call.deals?.deal_name ?? 'Deal'}</h3>
                    <p className="text-sm text-slate-500">{[call.deals?.address, call.deals?.city, call.deals?.state].filter(Boolean).join(', ')}</p>
                  </div>
                  {call.deals?.score && (
                    <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                      {call.deals.score.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-600 mt-3">{call.summary_text || 'No summary available.'}</p>
                <div className="flex gap-2 mt-3">
                  <select
                    value={call.call_status}
                    onChange={async (e) => {
                      const status = e.target.value
                      await fetch(`/api/calls/${call.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ call_status: status }),
                      })
                      window.location.reload()
                    }}
                    className="text-sm border border-slate-300 rounded px-2 py-1"
                  >
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
            ))}
          </div>

          {completed.length > 0 && (
            <details>
              <summary className="text-sm font-medium text-slate-600 cursor-pointer">Completed Calls ({completed.length})</summary>
              <div className="space-y-3 mt-3">
                {completed.map((call) => (
                  <div key={call.id} className="bg-white rounded-xl border border-slate-200 p-5 opacity-60">
                    <h3 className="font-semibold text-slate-900">{call.deals?.deal_name ?? 'Deal'}</h3>
                    <p className="text-xs text-slate-400 mt-1">Status: {call.call_status}</p>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
