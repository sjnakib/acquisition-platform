interface PipelineTableProps {
  data: Array<{
    campaign_name: string
    market: string
    leads: number
    emails_sent: number
    responses_positive: number
    underwritten: number
    scored_good: number
    loi_count: number
    closed_count: number
  }>
  onCampaignClick?: (name: string) => void
}

export function PipelineTable({ data, onCampaignClick }: PipelineTableProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Campaign</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Leads</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Sent</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Responses</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">UW</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Good</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">LOI</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Closed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((row) => (
              <tr
                key={row.campaign_name}
                onClick={() => onCampaignClick?.(row.campaign_name)}
                className="hover:bg-slate-50 cursor-pointer"
              >
                <td className="px-4 py-3 font-medium text-slate-900">{row.campaign_name}</td>
                <td className="px-4 py-3 text-right">{Number(row.leads)}</td>
                <td className="px-4 py-3 text-right">{Number(row.emails_sent)}</td>
                <td className="px-4 py-3 text-right">{Number(row.responses_positive)}</td>
                <td className="px-4 py-3 text-right">{Number(row.underwritten)}</td>
                <td className="px-4 py-3 text-right">{Number(row.scored_good)}</td>
                <td className="px-4 py-3 text-right">{Number(row.loi_count)}</td>
                <td className="px-4 py-3 text-right">{Number(row.closed_count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
