'use client'

import { useState, useEffect } from 'react'
import { CallBrief } from './CallBrief'

interface Call {
 id: string;
 call_status: string;
 summary_text: string | null;
 published: boolean;
 client_notes: string | null;
 deals?: {
 score: string | null;
 deal_fields?: { value: string | null; field_definitions: { key: string; label: string; data_type: string } | null }[] | null;
 };
}

export function CallQueue() {
 const [calls, setCalls] = useState<Call[]>([])
 const [loading, setLoading] = useState(true)

 useEffect(() => {
 fetch('/api/calls')
 .then((r) => r.json())
 .then(setCalls)
 .catch(console.error)
 .finally(() => setLoading(false))
 }, [])

 if (loading) return <div className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>Loading...</div>

 const pending = calls.filter((c) => c.call_status === 'pending')
 const completed = calls.filter((c) => c.call_status !== 'pending')

 return (
 <div className="space-y-4">
 {pending.map((call) => (
 <CallBrief key={call.id} brief={call} />
 ))}
 {completed.length > 0 && (
 <details>
 <summary className="text-sm font-medium cursor-pointer">
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
