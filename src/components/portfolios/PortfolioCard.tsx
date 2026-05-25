import Link from 'next/link'
import { FolderKanban, ArrowRight } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { Tooltip } from '@/components/ui/tooltip'

interface PortfolioCardProps {
  id: string
  name: string
  description: string | null
  dealCount: number
  createdAt: string
  projectId?: string
}

export function PortfolioCard({ id, name, description, dealCount, createdAt, projectId }: PortfolioCardProps) {
  const isDisabled = dealCount === 0
  const href = projectId ? `/projects/${projectId}/portfolios/${id}` : `/portfolios/${id}`

  const cardContent = (
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300 ease-[var(--ease-spring)] group-hover:scale-105"
          style={{ background: 'var(--color-surface-1)' }}
        >
          <FolderKanban className="h-5 w-5 transition-colors duration-300 group-hover:text-[var(--accent)]" style={{ color: 'var(--accent)' }} />
        </div>
        <div>
          <h3 className="text-[15px] font-medium transition-colors duration-300 group-hover:text-[var(--accent)]" style={{ color: 'var(--color-text-primary)' }}>{name}</h3>
          {description && (
            <p className="text-[13px] mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{description}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 text-right">
        <div>
          <p className="text-[13px] font-medium" style={{ color: 'var(--color-text-primary)' }}>{dealCount} deals</p>
          <p className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>{formatDate(createdAt)}</p>
        </div>
        {!isDisabled && (
          <ArrowRight
            size={16}
            className="transition-all duration-300 ease-[var(--ease-spring)] group-hover:translate-x-1 group-hover:text-[var(--accent)]"
            style={{ color: 'var(--color-text-tertiary)' }}
          />
        )}
      </div>
    </div>
  )

  if (isDisabled) {
    return (
      <Tooltip content="Add deal(s) to the portfolio first from Deals table">
        <div
          className="block p-5 rounded-lg border opacity-60 cursor-not-allowed select-none w-full"
          style={{
            background: 'var(--color-surface-0)',
            borderColor: 'var(--color-surface-2)',
          }}
        >
          {cardContent}
        </div>
      </Tooltip>
    )
  }

  return (
    <Link
      href={href}
      className="group block p-5 rounded-lg border transition-all duration-300 ease-[var(--ease-fluid)] hover:shadow-md hover:-translate-y-[2px] cursor-pointer"
      style={{
        background: 'var(--color-surface-0)',
        borderColor: 'var(--color-surface-2)',
      }}
    >
      {cardContent}
    </Link>
  )
}
