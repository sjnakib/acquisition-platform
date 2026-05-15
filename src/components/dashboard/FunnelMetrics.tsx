interface FunnelMetricsProps {
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
}

export function FunnelMetrics({ data }: FunnelMetricsProps) {
 const total = data.reduce(
 (acc, row) => ({
 leads: acc.leads + Number(row.leads),
 emails_sent: acc.emails_sent + Number(row.emails_sent),
 responses: acc.responses + Number(row.responses_positive),
 underwritten: acc.underwritten + Number(row.underwritten),
 scored_good: acc.scored_good + Number(row.scored_good),
 loi: acc.loi + Number(row.loi_count),
 closed: acc.closed + Number(row.closed_count),
 }),
 { leads: 0, emails_sent: 0, responses: 0, underwritten: 0, scored_good: 0, loi: 0, closed: 0 }
 )

 const stages = [
 { label: 'Leads', count: total.leads },
 { label: 'Emails Sent', count: total.emails_sent },
 { label: 'Responses', count: total.responses },
 { label: 'Underwritten', count: total.underwritten },
 { label: 'Scored Good', count: total.scored_good },
 { label: 'LOI', count: total.loi },
 { label: 'Closed', count: total.closed },
 ]

 const maxCount = Math.max(...stages.map((s) => s.count), 1)

 return (
 <div className=" rounded-xl border p-6">
 <h3 className="text-sm font-semibold mb-4">Pipeline Funnel</h3>
 <div className="space-y-2">
 {stages.map((stage) => {
 const width = (stage.count / maxCount) * 100
 return (
 <div key={stage.label} className="flex items-center gap-3">
 <span className="text-xs w-24 text-right">{stage.label}</span>
 <div className="flex-1 h-7 rounded relative overflow-hidden">
 <div
 className="h-full bg-gradient-to-r from-primary to-success rounded transition-all"
 style={{ width: `${width}%` }}
 />
 </div>
 <span className="text-xs font-medium w-16">{stage.count}</span>
 </div>
 )
 })}
 </div>
 </div>
 )
}
