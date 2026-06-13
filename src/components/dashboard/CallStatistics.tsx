'use client'

import { useState, useEffect } from 'react'

interface CallStatisticsProps {
  stats?: {
    total: number
    pending: number
    completed: number
    cancelled: number
    published: number
  }
}

export function CallStatistics({
  stats = { total: 0, pending: 0, completed: 0, cancelled: 0, published: 0 },
}: CallStatisticsProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 150)
    return () => clearTimeout(timer)
  }, [])

  const { total, pending, completed, cancelled, published } = stats

  const completedPct = total > 0 ? (completed / total) * 100 : 0
  const pendingPct = total > 0 ? (pending / total) * 100 : 0
  const cancelledPct = total > 0 ? (cancelled / total) * 100 : 0
  const completionRateText = total > 0 ? ((completed / total) * 100).toFixed(1) : '0.0'

  const items = [
    { label: 'Pending Queue', value: pending, rate: total > 0 ? pendingPct : 0, color: 'var(--color-warning-solid)' },
    { label: 'Completed Queue', value: completed, rate: total > 0 ? completedPct : 0, color: 'var(--color-success-solid)' },
    { label: 'Cancelled / Archived', value: cancelled, rate: total > 0 ? cancelledPct : 0, color: 'var(--color-text-tertiary)' },
    { label: 'Published to Client', value: published, rate: total > 0 ? (published / total) * 100 : 0, color: 'var(--accent)' },
  ]

  // SVG Radial Circle config - optimized for w-32 h-32 container
  const radius = 46
  const strokeWidth = 7
  const circumference = 2 * Math.PI * radius // ~289.03

  const completedLen = (completedPct / 100) * circumference
  const pendingLen = (pendingPct / 100) * circumference
  const cancelledLen = (cancelledPct / 100) * circumference

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
            Phone-Call Requests
          </h3>
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            Overview of outreach phone-call request states
          </p>
        </div>

        <div className="flex flex-col gap-5 items-stretch">
          {/* Radial progress display */}
          <div className="flex flex-col items-center justify-center p-4 rounded-lg relative" style={{ background: 'var(--color-canvas)' }}>
            <svg className="w-32 h-32 transform -rotate-90">
              {/* Background Track Circle */}
              <circle
                cx="64"
                cy="64"
                r={radius}
                stroke="var(--color-surface-2)"
                strokeWidth={strokeWidth}
                fill="transparent"
              />

              {total > 0 ? (
                <>
                  {/* Segment 1: Completed (Green) */}
                  <circle
                    cx="64"
                    cy="64"
                    r={radius}
                    stroke="var(--color-success-solid)"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    strokeDasharray={`${mounted ? completedLen : 0} ${circumference}`}
                    strokeDashoffset={0}
                    strokeLinecap={completedLen > 0 ? "round" : "butt"}
                    style={{
                      transition: 'stroke-dasharray 1s ease-[var(--ease-premium)]',
                    }}
                  />

                  {/* Segment 2: Pending (Amber) */}
                  <circle
                    cx="64"
                    cy="64"
                    r={radius}
                    stroke="var(--color-warning-solid)"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    strokeDasharray={`${mounted ? pendingLen : 0} ${circumference}`}
                    strokeDashoffset={-completedLen}
                    strokeLinecap={pendingLen > 0 ? "round" : "butt"}
                    style={{
                      transition: 'stroke-dasharray 1s ease-[var(--ease-premium)], stroke-dashoffset 1s ease-[var(--ease-premium)]',
                    }}
                  />

                  {/* Segment 3: Cancelled (Grey) */}
                  <circle
                    cx="64"
                    cy="64"
                    r={radius}
                    stroke="var(--color-text-tertiary)"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    strokeDasharray={`${mounted ? cancelledLen : 0} ${circumference}`}
                    strokeDashoffset={-(completedLen + pendingLen)}
                    strokeLinecap={cancelledLen > 0 ? "round" : "butt"}
                    style={{
                      transition: 'stroke-dasharray 1s ease-[var(--ease-premium)], stroke-dashoffset 1s ease-[var(--ease-premium)]',
                    }}
                  />
                </>
              ) : null}
            </svg>

            {/* Inner Content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>
                {total}
              </span>
              <span className="text-[8px] uppercase tracking-wider text-[var(--color-text-tertiary)] font-bold">
                Total Requests
              </span>
              {/* Subtle Pulsing Dot representing queue activity */}
              {pending > 0 && (
                <span className="absolute top-[18px] flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-warning-solid)] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--color-warning-solid)]"></span>
                </span>
              )}
            </div>
          </div>

          {/* Call stats details list */}
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={item.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span style={{ color: 'var(--color-text-secondary)' }}>{item.label}</span>
                  <span className="font-semibold" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-jetbrains-mono)' }}>
                    {item.value} <span className="text-[10px] font-normal text-[var(--color-text-tertiary)]">({item.rate.toFixed(0)}%)</span>
                  </span>
                </div>
                <div className="h-1 w-full rounded-full" style={{ background: 'var(--color-canvas)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-[800ms] ease-[var(--ease-premium)]"
                    style={{
                      width: mounted ? `${item.rate}%` : '0%',
                      backgroundColor: item.color,
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
