'use client'

import { useRouter } from 'next/navigation'
import { Megaphone, ArrowRight, TrendingUp, Calendar } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

export interface CampaignCardProps {
  id: string
  name: string
  market: string
  listingType: string | null
  isActive: boolean
  dealCount: number
  awaitingReviewCount?: number
  createdAt: string
  projectId?: string
}

export function CampaignCard({
  id,
  name,
  market,
  listingType,
  isActive,
  dealCount,
  awaitingReviewCount,
  createdAt,
  projectId,
}: CampaignCardProps) {
  const router = useRouter()
  const href = projectId
    ? `/projects/${projectId}/campaigns/${id}`
    : `/campaigns/${id}`

  return (
    <button
      onClick={() => router.push(href)}
      className="w-full group text-left p-5 rounded-lg border transition-all duration-300 ease-[var(--ease-fluid)] hover:shadow-md hover:-translate-y-[2px] cursor-pointer"
      style={{
        background: 'var(--color-surface-0)',
        borderColor: 'var(--color-border)',
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300 ease-[var(--ease-spring)] group-hover:scale-105"
          style={{
            background: isActive ? 'var(--color-accent-light)' : 'var(--color-surface-2)',
            color: isActive ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
          }}
        >
          <Megaphone size={20} />
        </div>
        <ArrowRight
          size={16}
          className="transition-all duration-300 ease-[var(--ease-spring)] group-hover:translate-x-1 group-hover:text-[var(--accent)]"
          style={{ color: 'var(--color-text-tertiary)' }}
        />
      </div>

      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <h3
          className="font-semibold text-sm truncate max-w-[180px]"
          style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans)' }}
        >
          {name}
        </h3>
        <Badge variant={isActive ? 'success' : 'neutral'} size="sm">
          {isActive ? 'Active' : 'Inactive'}
        </Badge>
        {awaitingReviewCount && awaitingReviewCount > 0 ? (
          <Badge variant="warning" size="sm" className="animate-pulse">
            {awaitingReviewCount} Reply Pending{awaitingReviewCount > 1 ? 's' : ''}
          </Badge>
        ) : null}
      </div>

      <p className="text-xs mb-3 line-clamp-2" style={{ color: 'var(--color-text-secondary)' }}>
        {market}
        {listingType ? ` · ${listingType.replace(/_/g, ' ')}` : ''}
      </p>

      <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
        <span className="flex items-center gap-1">
          <TrendingUp size={12} />
          {dealCount} lead{dealCount !== 1 ? 's' : ''}
        </span>
        <span className="select-none">·</span>
        <span className="flex items-center gap-1">
          <Calendar size={12} />
          {formatDate(createdAt)}
        </span>
      </div>
    </button>
  )
}

