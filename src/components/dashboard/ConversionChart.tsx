interface ConversionChartProps {
  data: Array<{
    campaign_name: string
    leads: number
    emails_sent: number
    responses_positive: number
    loi_count: number
    closed_count: number
  }>
}

export function ConversionChart({ data }: ConversionChartProps) {
  const total = data.reduce(
    (acc, row) => ({
      leads: acc.leads + Number(row.leads),
      sent: acc.sent + Number(row.emails_sent),
      responses: acc.responses + Number(row.responses_positive),
      loi: acc.loi + Number(row.loi_count),
      closed: acc.closed + Number(row.closed_count),
    }),
    { leads: 0, sent: 0, responses: 0, loi: 0, closed: 0 }
  )

  const rates = [
    { label: 'Lead → Sent', rate: total.leads > 0 ? ((total.sent / total.leads) * 100).toFixed(1) : '0.0' },
    { label: 'Sent → Response', rate: total.sent > 0 ? ((total.responses / total.sent) * 100).toFixed(1) : '0.0' },
    { label: 'Response → LOI', rate: total.responses > 0 ? ((total.loi / total.responses) * 100).toFixed(1) : '0.0' },
    { label: 'LOI → Closed', rate: total.loi > 0 ? ((total.closed / total.loi) * 100).toFixed(1) : '0.0' },
  ]

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Conversion Rates</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {rates.map((r) => (
          <div key={r.label} className="text-center">
            <p className="text-2xl font-bold text-blue-600">{r.rate}%</p>
            <p className="text-xs text-slate-500 mt-1">{r.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
