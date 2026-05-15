'use client'

import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataGrid, type ColumnDef } from '@/components/shared/DataGrid'

interface Deal {
 id: string
 deal_name: string | null
 address: string | null
 city: string | null
 state: string | null
 unit_count: number | null
 year_built: number | null
 score: string | null
}

const columns: ColumnDef<Deal>[] = [
 { key: 'deal_name', header: 'Property Name', minWidth: 160, sortable: true,
 render: (r) => <span className="font-medium ">{r.deal_name ?? 'Untitled'}</span> },
 { key: 'address', header: 'Address', minWidth: 180, sortable: true,
 accessor: (r) => [r.address, r.city, r.state].filter(Boolean).join(', '),
 render: (r) => <span className="">{[r.address, r.city, r.state].filter(Boolean).join(', ') || '—'}</span> },
 { key: 'unit_count', header: 'Units', align: 'right', width: 80, sortable: true,
 render: (r) => <span className="tabular-nums">{r.unit_count ?? '—'}</span> },
 { key: 'year_built', header: 'Year Built', align: 'right', width: 100, sortable: true,
 render: (r) => <span className="tabular-nums">{r.year_built ?? '—'}</span> },
 { key: 'score', header: 'Score', width: 110, sortable: true,
 render: (r) => {
 if (!r.score) return <span className=" text-xs">Unscored</span>
 const colors: Record<string, string> = {
 very_good: ' ', good: ' ',
 bad: ' ', very_bad: ' ',
 }
 return (
 <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${colors[r.score] ?? ' '}`}>
 {r.score.replace(/_/g, ' ')}
 </span>
 )
 },
 },
];

export default function ClientOverviewPage() {
 const [deals, setDeals] = useState<Deal[]>([])
 const [loading, setLoading] = useState(true)

 useEffect(() => {
 fetch('/api/deals')
 .then((r) => r.json())
 .then((data) => setDeals(data))
 .catch(console.error)
 .finally(() => setLoading(false))
 }, [])

 return (
 <div>
 <PageHeader title="Active Deals" description="Properties your team is actively pursuing" />
 <DataGrid
 columns={columns}
 data={deals}
 rowKey={(r) => r.id}
 loading={loading}
 emptyMessage="No active deals yet — your team will notify you when deals are ready."
 maxHeight="calc(100vh - 230px)"
 />
 </div>
 )
}
