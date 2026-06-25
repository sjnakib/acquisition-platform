'use client'

import { useState, useEffect } from 'react'

interface FunnelMetricsProps {
  data: Array<{
    campaign_name: string
    market: string
    leads: number
    emails_sent: number
    awaiting_review: number
    responses_positive: number
    underwritten: number
    scored_good: number
    loi_count: number
    closed_count: number
  }>
}

export function FunnelMetrics({ data = [] }: FunnelMetricsProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100)
    return () => clearTimeout(timer)
  }, [])

  const total = data.reduce(
    (acc, row) => ({
      leads: acc.leads + Number(row.leads),
      emails_sent: acc.emails_sent + Number(row.emails_sent),
      awaiting_review: acc.awaiting_review + Number(row.awaiting_review ?? 0),
      responses: acc.responses + Number(row.responses_positive),
      underwritten: acc.underwritten + Number(row.underwritten),
      scored_good: acc.scored_good + Number(row.scored_good),
      loi: acc.loi + Number(row.loi_count),
      closed: acc.closed + Number(row.closed_count),
    }),
    { leads: 0, emails_sent: 0, awaiting_review: 0, responses: 0, underwritten: 0, scored_good: 0, loi: 0, closed: 0 }
  )

  const conversionRate = total.leads > 0 ? (total.closed / total.leads) * 100 : 0

  const tiles = [
    { label: 'Leads', count: total.leads.toString(), rate: 100, color: 'var(--accent)' },
    { label: 'Outreach Sent', count: total.emails_sent.toString(), rate: total.leads > 0 ? (total.emails_sent / total.leads) * 100 : 0, color: 'var(--color-info-solid)' },
    { label: 'Awaiting Review', count: total.awaiting_review.toString(), rate: total.emails_sent > 0 ? (total.awaiting_review / total.emails_sent) * 100 : 0, color: 'var(--color-warning-solid)' },
    { label: 'Responses', count: total.responses.toString(), rate: total.emails_sent > 0 ? (total.responses / total.emails_sent) * 100 : 0, color: 'var(--color-success-solid)' },
    { label: 'Underwritten', count: total.underwritten.toString(), rate: total.leads > 0 ? (total.underwritten / total.leads) * 100 : 0, color: 'var(--color-neutral-text)' },
    { label: 'Scored Good+', count: total.scored_good.toString(), rate: total.underwritten > 0 ? (total.scored_good / total.underwritten) * 100 : 0, color: 'var(--color-success-solid)' },
    { label: 'LOI Submitted', count: total.loi.toString(), rate: total.underwritten > 0 ? (total.loi / total.underwritten) * 100 : 0, color: 'var(--color-success-solid)' },
    { label: 'Closed Deals', count: total.closed.toString(), rate: total.loi > 0 ? (total.closed / total.loi) * 100 : 0, color: 'var(--accent)' },
    { label: 'Funnel Yield', count: `${conversionRate.toFixed(1)}%`, rate: conversionRate, color: 'var(--accent)' },
  ]

  return (
    <div
      className="rounded-xl border p-6 flex flex-col h-full justify-between animate-item-entrance"
      style={{
        background: 'var(--color-surface-0)',
        borderColor: 'var(--color-surface-2)',
        boxShadow: 'var(--shadow-sm)',
        animationDelay: '50ms',
      }}
    >
      <div>
        <div className="flex items-center justify-between mb-5">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans)' }}>
              Acquisition Funnel
            </h3>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              Volume and progression of property pipeline stages
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {tiles.map((tile, idx) => (
            <div
              key={tile.label}
              className="group relative rounded-lg border border-[var(--color-surface-2)] bg-[var(--color-canvas)] p-3 h-[78px] flex flex-col justify-between transition-all duration-300 ease-[var(--ease-fluid)] hover:border-[var(--accent)] hover:shadow-sm"
              style={{
                animationDelay: `${idx * 40}ms`,
              }}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] truncate">
                {tile.label}
              </span>
              <span
                className="text-xl font-bold text-[var(--color-text-primary)]"
                style={{ fontFamily: 'var(--font-jetbrains-mono)' }}
              >
                {tile.count}
              </span>
              <div className="h-1 w-full rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-[800ms] ease-[var(--ease-premium)]"
                  style={{
                    width: mounted ? `${tile.rate}%` : '0%',
                    backgroundColor: tile.color,
                    transitionDelay: `${idx * 40}ms`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
