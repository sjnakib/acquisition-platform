'use client'

import { useState, useEffect } from 'react'
import { CallBrief } from './CallBrief'

export function CallQueue() {
  const [calls, setCalls] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/calls')
      .then((r) => r.json())
      .then(setCalls)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-sm text-slate-400">Loading...</div>

  const pending = calls.filter((c) => c.call_status === 'pending')
  const completed = calls.filter((c) => c.call_status !== 'pending')

  return (
    <div className="space-y-4">
      {pending.map((call) => (
        <CallBrief key={call.id} brief={call} />
      ))}
      {completed.length > 0 && (
        <details>
          <summary className="text-sm font-medium text-slate-600 cursor-pointer">
            Completed Calls ({completed.length})
          </summary>
          <div className="space-y-3 mt-3">
            {completed.map((call) => (
              <div key={call.id} className="opacity-60">
                <CallBrief brief={call} />
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
