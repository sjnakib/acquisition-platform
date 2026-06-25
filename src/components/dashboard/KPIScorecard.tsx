import { Building2, Send, MessageSquare, ClipboardCheck, FileText, CheckCircle2, Mail } from 'lucide-react'

interface KPIScorecardProps {
  data: Array<{
    campaign_name: string
    market: string
    leads: number
    emails_sent: number
    awaiting_review?: number
    responses_positive: number
    underwritten: number
    scored_good: number
    loi_count: number
    closed_count: number
  }>
}

export function KPIScorecard({ data = [] }: KPIScorecardProps) {
  const total = data.reduce(
    (acc, row) => ({
      leads: acc.leads + Number(row.leads),
      sent: acc.sent + Number(row.emails_sent),
      awaiting_review: acc.awaiting_review + Number(row.awaiting_review ?? 0),
      responses: acc.responses + Number(row.responses_positive),
      underwritten: acc.underwritten + Number(row.underwritten),
      good: acc.good + Number(row.scored_good),
      loi: acc.loi + Number(row.loi_count),
      closed: acc.closed + Number(row.closed_count),
    }),
    { leads: 0, sent: 0, awaiting_review: 0, responses: 0, underwritten: 0, good: 0, loi: 0, closed: 0 }
  )

  const responseRate = total.sent > 0 ? ((total.responses / total.sent) * 100).toFixed(1) : '0.0'
  const outreachRate = total.leads > 0 ? ((total.sent / total.leads) * 100).toFixed(1) : '0.0'
  const underwrittenRate = total.leads > 0 ? ((total.underwritten / total.leads) * 100).toFixed(1) : '0.0'
  const loiRate = total.underwritten > 0 ? ((total.loi / total.underwritten) * 100).toFixed(1) : '0.0'

  const kpis = [
    {
      label: 'Total Leads',
      value: total.leads,
      subtext: `Across ${data.length} campaign${data.length === 1 ? '' : 's'}`,
      icon: Building2,
      color: 'var(--accent)',
      bgColor: 'var(--color-accent-bg)',
    },
    {
      label: 'Outreach Sent',
      value: total.sent,
      subtext: `${outreachRate}% of leads contacted`,
      icon: Send,
      color: 'var(--color-info-solid)',
      bgColor: 'var(--color-info-bg)',
    },
    {
      label: 'Awaiting Review',
      value: total.awaiting_review,
      subtext: `${total.awaiting_review} unread reply${total.awaiting_review === 1 ? '' : 'ies'}`,
      icon: Mail,
      color: 'var(--color-warning-solid)',
      bgColor: 'var(--color-warning-bg)',
    },
    {
      label: 'Response Rate',
      value: `${responseRate}%`,
      subtext: `${total.responses} positive response${total.responses === 1 ? '' : 's'}`,
      icon: MessageSquare,
      color: 'var(--color-warning-solid)',
      bgColor: 'var(--color-warning-bg)',
    },
    {
      label: 'Underwritten',
      value: total.underwritten,
      subtext: `${underwrittenRate}% qualified rate`,
      icon: ClipboardCheck,
      color: 'var(--color-neutral-text)',
      bgColor: 'var(--color-neutral-bg)',
    },
    {
      label: 'LOIs Submitted',
      value: total.loi,
      subtext: `${loiRate}% of underwritten`,
      icon: FileText,
      color: 'var(--color-success-solid)',
      bgColor: 'var(--color-success-bg)',
    },
    {
      label: 'Deals Closed',
      value: total.closed,
      subtext: 'Completed acquisitions',
      icon: CheckCircle2,
      color: 'var(--accent)',
      bgColor: 'var(--color-accent-bg)',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
      {kpis.map((kpi, idx) => {
        const Icon = kpi.icon
        return (
          <div
            key={kpi.label}
            className="animate-item-entrance group relative rounded-xl border p-4 transition-all duration-300 ease-[var(--ease-fluid)] hover:-translate-y-1 hover:shadow-md cursor-default overflow-hidden"
            style={{
              background: 'var(--color-surface-0)',
              borderColor: 'var(--color-surface-2)',
              animationDelay: `${idx * 60}ms`,
            }}
          >
            {/* Top accent line */}
            <div
              className="absolute top-0 left-0 right-0 h-[3px]"
              style={{ backgroundColor: kpi.color }}
            />

            <div className="flex items-start justify-between mb-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.06em]" style={{ color: 'var(--color-text-tertiary)' }}>
                {kpi.label}
              </p>
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                style={{ backgroundColor: kpi.bgColor, color: kpi.color }}
              >
                <Icon size={14} />
              </div>
            </div>

            <p
              className="text-[28px] font-bold leading-tight mb-1"
              style={{
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-jetbrains-mono)',
              }}
            >
              {kpi.value}
            </p>

            <p className="text-[11px] font-medium line-clamp-1" style={{ color: 'var(--color-text-secondary)' }}>
              {kpi.subtext}
            </p>
          </div>
        )
      })}
    </div>
  )
}
