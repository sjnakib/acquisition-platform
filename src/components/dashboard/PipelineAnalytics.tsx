'use client'

import { useState, useEffect } from 'react'

interface Deal {
  id: string
  address: string | null
  unit_count: number | null
  stage: string
  score: string | null
  is_archived?: boolean
  market?: string
}

interface PipelineAnalyticsProps {
  deals?: Deal[]
}

export function PipelineAnalytics({ deals = [] }: PipelineAnalyticsProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100)
    return () => clearTimeout(timer)
  }, [])

  // 1. Calculate Score Distribution (only for underwritten/scored deals)
  const scoredDeals = deals.filter((d) => d.score && !d.is_archived)
  const totalScored = scoredDeals.length

  const scores = {
    very_good: scoredDeals.filter((d) => d.score === 'very_good').length,
    good: scoredDeals.filter((d) => d.score === 'good').length,
    bad: scoredDeals.filter((d) => d.score === 'bad').length,
    very_bad: scoredDeals.filter((d) => d.score === 'very_bad').length,
  }

  const scoreItems = [
    { label: 'Very Good', count: scores.very_good, color: 'var(--color-score-vg-text)', bg: 'var(--color-score-vg-bg)' },
    { label: 'Good', count: scores.good, color: 'var(--color-score-g-text)', bg: 'var(--color-score-g-bg)' },
    { label: 'Bad', count: scores.bad, color: 'var(--color-score-b-text)', bg: 'var(--color-score-b-bg)' },
    { label: 'Very Bad', count: scores.very_bad, color: 'var(--color-score-vb-text)', bg: 'var(--color-score-vb-bg)' },
  ]

  // 2. Calculate Market Distribution (only active, non-archived deals)
  const activeDeals = deals.filter((d) => d.stage !== 'archived' && d.stage !== 'failed' && !d.is_archived)
  const totalActive = activeDeals.length

  const marketCounts = new Map<string, number>()
  for (const d of activeDeals) {
    const market = d.market ?? 'Unassigned'
    marketCounts.set(market, (marketCounts.get(market) ?? 0) + 1)
  }

  const marketItems = Array.from(marketCounts.entries())
    .map(([market, count]) => ({ market, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)

  const maxMarketCount = Math.max(...marketItems.map((m) => m.count), 1)

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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch divide-y md:divide-y-0 md:divide-x divide-[var(--color-surface-2)]">
        {/* Left Column: Underwriting Yield / Score distribution */}
        <div className="flex flex-col justify-between">
          <div>
            <div className="flex flex-col gap-1 mb-4">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans)' }}>
                Underwriting Yield
              </h3>
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                Scoring distribution of underwritten assets ({totalScored} total)
              </p>
            </div>

            {totalScored === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center text-[var(--color-text-tertiary)]">
                <span className="text-xs">No underwriting scores logged</span>
              </div>
            ) : (
              <div className="space-y-3">
                {scoreItems.map((item, idx) => {
                  const pct = totalScored > 0 ? (item.count / totalScored) * 100 : 0
                  return (
                    <div key={item.label} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                          {item.label}
                        </span>
                        <span className="font-semibold" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-jetbrains-mono)' }}>
                          {item.count} <span className="text-[10px] font-normal text-[var(--color-text-tertiary)]">({pct.toFixed(0)}%)</span>
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full" style={{ background: 'var(--color-canvas)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-[800ms]"
                          style={{
                            width: mounted ? `${pct}%` : '0%',
                            backgroundColor: item.color,
                            transitionDelay: `${idx * 60}ms`,
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Market Focus */}
        <div className="flex flex-col justify-between pt-6 md:pt-0 md:pl-8">
          <div>
            <div className="flex flex-col gap-1 mb-4">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans)' }}>
                Market Focus
              </h3>
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                Active pipeline distribution by geography ({totalActive} total)
              </p>
            </div>

            {marketItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center text-[var(--color-text-tertiary)]">
                <span className="text-xs">No active pipeline locations</span>
              </div>
            ) : (
              <div className="space-y-3">
                {marketItems.map((item, idx) => {
                  const pct = (item.count / maxMarketCount) * 100
                  const overallPct = totalActive > 0 ? (item.count / totalActive) * 100 : 0
                  return (
                    <div key={item.market} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium truncate mr-2" style={{ color: 'var(--color-text-secondary)' }}>
                          {item.market}
                        </span>
                        <span className="font-semibold" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-jetbrains-mono)' }}>
                          {item.count} <span className="text-[10px] font-normal text-[var(--color-text-tertiary)]">({overallPct.toFixed(0)}%)</span>
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full" style={{ background: 'var(--color-canvas)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-[800ms]"
                          style={{
                            width: mounted ? `${pct}%` : '0%',
                            backgroundColor: 'var(--accent)',
                            transitionDelay: `${idx * 60}ms`,
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
