'use client'

import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataGrid, type ColumnDef } from '@/components/shared/DataGrid'

interface Call {
 id: string
 call_status: string
 summary_text: string | null
 deals: {
 deal_name: string | null
 address: string | null
 city: string | null
 state: string | null
 score: string | null
 } | null
}

const scoreColors: Record<string, string> = {
 very_good: ' ', good: ' ',
 bad: ' ', very_bad: ' ',
}

export default function ClientCallsPage() {
 const [calls, setCalls] = useState<Call[]>([])
 const [loading, setLoading] = useState(true)

 useEffect(() => {
 fetch('/api/calls')
 .then((r) => r.json())
 .then((data) => setCalls(data))
 .catch(console.error)
 .finally(() => setLoading(false))
 }, [])

 const columns: ColumnDef<Call>[] = [
 { key: 'deal_name', header: 'Property', minWidth: 160, sortable: true,
 accessor: (r) => r.deals?.deal_name ?? '',
 render: (r) => <span className="font-medium ">{r.deals?.deal_name ?? 'Untitled'}</span> },
 { key: 'address', header: 'Address', minWidth: 160, sortable: true,
 accessor: (r) => [r.deals?.address, r.deals?.city, r.deals?.state].filter(Boolean).join(', '),
 render: (r) => <span className="">{[r.deals?.address, r.deals?.city, r.deals?.state].filter(Boolean).join(', ') || '—'}</span> },
 { key: 'score', header: 'Score', width: 110, sortable: true,
 accessor: (r) => r.deals?.score ?? '',
 render: (r) => {
 const s = r.deals?.score
 if (!s) return <span className=" text-xs">—</span>
 return (
 <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${scoreColors[s] ?? ' '}`}>
 {s.replace(/_/g, ' ')}
 </span>
 )
 }},
 { key: 'summary_text', header: 'Summary', minWidth: 200, sortable: true,
 render: (r) => <span className=" text-xs line-clamp-2">{r.summary_text || 'No summary available.'}</span> },
 { key: 'call_status', header: 'Status', width: 120, sortable: true,
 render: (r) => (
 <select
 value={r.call_status}
 onChange={async (e) => {
 const status = e.target.value
 await fetch(`/api/calls/${r.id}`, {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ call_status: status }),
 })
 window.location.reload()
 }}
 onClick={(e) => e.stopPropagation()}
 className={`text-xs border rounded px-2 py-0.5 font-medium ${
 r.call_status === 'pending' ? 'border-warning/30 ' :
 r.call_status === 'completed' ? 'border-success/30 ' :
 ' '
 }`}
 >
 <option value="pending">Pending</option>
 <option value="completed">Completed</option>
 <option value="cancelled">Cancelled</option>
 </select>
 ),
 },
 ];

 return (
 <div>
 <PageHeader title="Call Queue" description="Review these deals before your call with the team" />
 <DataGrid
 columns={columns}
 data={calls}
 rowKey={(r) => r.id}
 loading={loading}
 emptyMessage="No calls queued yet — your team will notify you."
 maxHeight="calc(100vh - 230px)"
 />
 </div>
 )
}
