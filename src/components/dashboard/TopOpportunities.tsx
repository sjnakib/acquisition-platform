'use client'

import { useRouter } from 'next/navigation'
import { DealScoreBadge } from '../deals/DealScoreBadge'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, Building2 } from 'lucide-react'

interface TopOpportunitiesProps {
  deals: Array<{
    id: string
    address: string | null
    unit_count: number | null
    stage: string
    score: string | null
    is_archived?: boolean
    created_at?: string
  }>
  projectId: string
}

export function TopOpportunities({ deals = [], projectId }: TopOpportunitiesProps) {
  const router = useRouter()

  // Filter deals: score is good or very_good, and stage is active (not closed, failed, or archived)
  // Increase limit to 8 to utilize full-width space cleanly
  const activeOpportunities = deals
    .filter(
      (d) =>
        (d.score === 'good' || d.score === 'very_good') &&
        d.stage !== 'closed' &&
        d.stage !== 'failed' &&
        d.stage !== 'archived' &&
        !d.is_archived
    )
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    .slice(0, 8)

  return (
    <div
      className="rounded-xl border p-6 flex flex-col h-full justify-between animate-item-entrance"
      style={{
        background: 'var(--color-surface-0)',
        borderColor: 'var(--color-surface-2)',
        boxShadow: 'var(--shadow-sm)',
        animationDelay: '150ms',
      }}
    >
      <div>
        <div className="flex flex-col gap-1 mb-5">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans)' }}>
            High-Score Opportunities
          </h3>
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            Active deals rated Good or Very Good
          </p>
        </div>

        {activeOpportunities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Building2 className="w-8 h-8 mb-2" style={{ color: 'var(--color-text-tertiary)' }} />
            <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              No high-score deals active
            </p>
            <p className="text-[11px] max-w-[200px] mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
              Complete underwriting and score deals to see opportunities here.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {activeOpportunities.map((deal) => (
              <div
                key={deal.id}
                onClick={() => router.push(`/projects/${projectId}/deals/${deal.id}`)}
                className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-[var(--color-surface-2)] bg-[var(--color-canvas)] hover:border-[var(--accent)] hover:shadow-sm cursor-pointer transition-all duration-300 ease-[var(--ease-fluid)] gap-3 sm:gap-4"
              >
                {/* Left: Building icon and property info */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--color-surface-0)] border border-[var(--color-surface-2)] text-[var(--accent)] group-hover:scale-105 transition-transform duration-300">
                    <Building2 size={16} />
                  </div>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span
                      className="text-sm font-semibold truncate text-[var(--color-text-primary)] group-hover:text-[var(--accent)] transition-colors duration-200"
                      style={{ fontFamily: 'var(--font-dm-sans)' }}
                    >
                      {deal.address ?? 'Untitled Property'}
                    </span>
                    <span className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
                      {deal.unit_count ? `${deal.unit_count} units` : '— units'}
                    </span>
                  </div>
                </div>

                {/* Right: Stage, Score, and Nav Link */}
                <div className="flex items-center justify-between sm:justify-end gap-6 flex-shrink-0">
                  <div className="sm:w-28 text-left sm:text-center">
                    <Badge variant="neutral" size="sm">
                      {deal.stage.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <div className="sm:w-24 text-left sm:text-center">
                    <DealScoreBadge score={deal.score} />
                  </div>
                  <ArrowRight
                    size={16}
                    className="transform transition-transform duration-300 group-hover:translate-x-1"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
