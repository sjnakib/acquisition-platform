import { DataGrid, type ColumnDef } from '@/components/shared/DataGrid'

interface PipelineRow {
 campaign_name: string
 market: string
 leads: number
 emails_sent: number
 responses_positive: number
 underwritten: number
 scored_good: number
 loi_count: number
 closed_count: number
}

interface PipelineTableProps {
 data: PipelineRow[]
 onCampaignClick?: (name: string) => void
}

const columns: ColumnDef<PipelineRow>[] = [
 { key: 'campaign_name', header: 'Campaign', minWidth: 160, sortable: true,
 render: (r) => <span className="font-medium ">{r.campaign_name}</span> },
 { key: 'market', header: 'Market', width: 80 },
 { key: 'leads', header: 'Leads', align: 'right', width: 70, sortable: true,
 render: (r) => <span className="tabular-nums">{r.leads}</span> },
 { key: 'emails_sent', header: 'Sent', align: 'right', width: 70, sortable: true,
 render: (r) => <span className="tabular-nums">{r.emails_sent}</span> },
 { key: 'responses_positive', header: 'Responses', align: 'right', width: 90, sortable: true,
 render: (r) => <span className="tabular-nums">{r.responses_positive}</span> },
 { key: 'underwritten', header: 'UW', align: 'right', width: 60, sortable: true,
 render: (r) => <span className="tabular-nums">{r.underwritten}</span> },
 { key: 'scored_good', header: 'Good', align: 'right', width: 65, sortable: true,
 render: (r) => <span className="tabular-nums">{r.scored_good}</span> },
 { key: 'loi_count', header: 'LOI', align: 'right', width: 60, sortable: true,
 render: (r) => <span className="tabular-nums">{r.loi_count}</span> },
 { key: 'closed_count', header: 'Closed', align: 'right', width: 70, sortable: true,
 render: (r) => <span className="tabular-nums">{r.closed_count}</span> },
];

export function PipelineTable({ data, onCampaignClick }: PipelineTableProps) {
 return (
 <DataGrid
 columns={columns}
 data={data}
 rowKey={(r) => r.campaign_name}
 onRowClick={onCampaignClick ? (r) => onCampaignClick(r.campaign_name) : undefined}
 emptyMessage="No pipeline data"
 maxHeight={400}
 />
 )
}
