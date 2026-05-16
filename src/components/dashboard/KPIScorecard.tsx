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
    { label: 'Total Leads', value: total.leads },
    { label: 'Emails Sent', value: total.sent },
    { label: 'Response Rate', value: `${responseRate}%` },
    { label: 'Underwritten', value: total.underwritten },
    { label: 'Good Deals', value: total.good },
    { label: 'LOIs Submitted', value: total.loi },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {kpis.map((kpi) => (
        <div
          key={kpi.label}
          className="rounded-xl border p-5"
          style={{
            background: 'var(--color-surface-0)',
            borderColor: 'var(--color-surface-2)',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <p className="text-[11px] uppercase tracking-[0.06em] mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
            {kpi.label}
          </p>
          <p
            className="text-[32px] font-semibold leading-tight"
            style={{
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-jetbrains-mono)',
            }}
          >
            {kpi.value}
          </p>
        </div>
      ))}
    </div>
  )
}
