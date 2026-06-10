'use client'

import { useState, useEffect } from 'react'

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

export function ConversionChart({ data = [] }: ConversionChartProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 150)
    return () => clearTimeout(timer)
  }, [])

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

  const overallConversion = total.leads > 0 ? (total.closed / total.leads) * 100 : 0
  const overallText = overallConversion.toFixed(1)

  const rates = [
    { label: 'Lead to Outbound', rate: total.leads > 0 ? (total.sent / total.leads) * 100 : 0 },
    { label: 'Outbound to Response', rate: total.sent > 0 ? (total.responses / total.sent) * 100 : 0 },
    { label: 'Response to LOI', rate: total.responses > 0 ? (total.loi / total.responses) * 100 : 0 },
    { label: 'LOI to Closed', rate: total.loi > 0 ? (total.closed / total.loi) * 100 : 0 },
  ]

  // SVG Radial Circle config - optimized for w-28 h-28 container
  const radius = 42
  const strokeWidth = 6
  const circumference = 2 * Math.PI * radius // ~263.89
  const strokeDashoffset = circumference - (overallConversion / 100) * circumference

  return (
    <div
      className="rounded-xl border p-6 flex flex-col h-full justify-between animate-item-entrance"
      style={{
        background: 'var(--color-surface-0)',
        borderColor: 'var(--color-surface-2)',
        boxShadow: 'var(--shadow-sm)',
        animationDelay: '100ms',
      }}
    >
      <div>
        <div className="flex flex-col gap-1 mb-5">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans)' }}>
            Conversion Performance
          </h3>
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            Key pipeline conversion and funnel efficiency
          </p>
        </div>

        <div className="flex flex-col gap-5 items-stretch">
          {/* Radial progress display */}
          <div className="flex flex-col items-center justify-center p-3 rounded-lg relative" style={{ background: 'var(--color-canvas)' }}>
            <svg className="w-28 h-28 transform -rotate-90">
              {/* Background Circle */}
              <circle
                cx="56"
                cy="56"
                r={radius}
                className="stroke-current"
                style={{ color: 'var(--color-surface-2)' }}
                strokeWidth={strokeWidth}
                fill="transparent"
              />
              {/* Foreground Circle */}
              <circle
                cx="56"
                cy="56"
                r={radius}
                stroke="var(--accent)"
                strokeWidth={strokeWidth}
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={mounted ? strokeDashoffset : circumference}
                strokeLinecap="round"
                style={{
                  transition: 'stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />
            </svg>

            {/* Inner Content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>
                {overallText}%
              </span>
              <span className="text-[8px] uppercase tracking-wider text-[var(--color-text-tertiary)] font-semibold">
                Leads to Closed
              </span>
            </div>
          </div>

          {/* Micro-conversions list */}
          <div className="space-y-3">
            {rates.map((r, idx) => (
              <div key={r.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span style={{ color: 'var(--color-text-secondary)' }}>{r.label}</span>
                  <span className="font-semibold" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-jetbrains-mono)' }}>
                    {r.rate.toFixed(1)}%
                  </span>
                </div>
                <div className="h-1 w-full rounded-full" style={{ background: 'var(--color-canvas)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-[800ms] ease-[var(--ease-premium)]"
                    style={{
                      width: mounted ? `${r.rate}%` : '0%',
                      background: 'var(--accent)',
                      transitionDelay: `${idx * 80}ms`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
