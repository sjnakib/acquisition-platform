interface KPIScorecardProps {
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

export function KPIScorecard({ data }: KPIScorecardProps) {
 const total = data.reduce(
 (acc, row) => ({
 leads: acc.leads + Number(row.leads),
 sent: acc.sent + Number(row.emails_sent),
 responses: acc.responses + Number(row.responses_positive),
 underwritten: acc.underwritten + Number(row.underwritten),
 good: acc.good + Number(row.scored_good),
 loi: acc.loi + Number(row.loi_count),
 }),
 { leads: 0, sent: 0, responses: 0, underwritten: 0, good: 0, loi: 0 }
 )

 const responseRate = total.sent > 0 ? ((total.responses / total.sent) * 100).toFixed(1) : '0.0'

 const kpis = [
 { label: 'Total Leads', value: total.leads, target: null },
 { label: 'Emails Sent', value: total.sent, target: null },
 { label: 'Response Rate', value: `${responseRate}%`, target: null },
 { label: 'Underwritten', value: total.underwritten, target: null },
 { label: 'Good Deals', value: total.good, target: null },
 { label: 'LOIs Submitted', value: total.loi, target: null },
 ]

 return (
 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
 {kpis.map((kpi) => (
 <div key={kpi.label} className=" rounded-xl border p-4">
 <p className="text-xs mb-1">{kpi.label}</p>
 <p className="text-2xl font-bold ">{kpi.value}</p>
 </div>
 ))}
 </div>
 )
}
