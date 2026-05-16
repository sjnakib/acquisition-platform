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
    { label: 'Lead to Sent', rate: total.leads > 0 ? ((total.sent / total.leads) * 100).toFixed(1) : '0.0' },
    { label: 'Sent to Response', rate: total.sent > 0 ? ((total.responses / total.sent) * 100).toFixed(1) : '0.0' },
    { label: 'Response to LOI', rate: total.responses > 0 ? ((total.loi / total.responses) * 100).toFixed(1) : '0.0' },
    { label: 'LOI to Closed', rate: total.loi > 0 ? ((total.closed / total.loi) * 100).toFixed(1) : '0.0' },
  ]

  return (
    <div className="rounded-xl border p-6" style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-surface-2)', boxShadow: 'var(--shadow-xs)' }}>
      <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans)' }}>Conversion Rates</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {rates.map((r) => (
          <div key={r.label} className="text-center">
            <p className="text-2xl font-bold" style={{ color: 'var(--accent)', fontFamily: 'var(--font-jetbrains-mono)' }}>{r.rate}%</p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>{r.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
