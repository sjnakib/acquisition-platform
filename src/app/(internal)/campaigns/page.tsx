'use client'

import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataGrid, type ColumnDef } from '@/components/shared/DataGrid'

interface Campaign {
 id: string
 name: string
 market: string
 listing_type: string | null
 is_active: boolean
}

const columns: ColumnDef<Campaign>[] = [
 { key: 'name', header: 'Name', minWidth: 160, sortable: true,
 render: (r) => <span className="font-medium">{r.name}</span> },
 { key: 'market', header: 'Market', width: 100, sortable: true },
 { key: 'listing_type', header: 'Type', width: 120, sortable: true,
 accessor: (r) => r.listing_type?.replace(/_/g, ' ') ?? '',
 render: (r) => <span className="">{r.listing_type?.replace(/_/g, ' ') ?? '—'}</span> },
 { key: 'is_active', header: 'Status', width: 100, sortable: true,
 accessor: (r) => r.is_active ? 'Active' : 'Inactive',
 render: (r) => (
 <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${r.is_active ? ' ' : ' '}`}>
 {r.is_active ? 'Active' : 'Inactive'}
 </span>
 )},
];

export default function CampaignsPage() {
 const [campaigns, setCampaigns] = useState<Campaign[]>([])
 const [loading, setLoading] = useState(true)

 useEffect(() => {
 fetch('/api/campaigns')
 .then((r) => r.json())
 .then((data) => setCampaigns(data))
 .catch(console.error)
 .finally(() => setLoading(false))
 }, [])

 return (
 <div>
 <PageHeader title="Campaigns" description="Manage your outreach campaigns" />
 <DataGrid
 columns={columns}
 data={campaigns}
 rowKey={(r) => r.id}
 loading={loading}
 emptyMessage="No campaigns — create one first"
 maxHeight="calc(100vh - 230px)"
 />
 </div>
 )
}
