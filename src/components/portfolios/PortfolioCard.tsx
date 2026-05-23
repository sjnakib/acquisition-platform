import Link from 'next/link'
import { FolderKanban } from 'lucide-react'
import { formatDate } from '@/lib/utils'

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
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--color-surface-1)' }}
        >
          <FolderKanban className="h-5 w-5" style={{ color: 'var(--accent)' }} />
        </div>
        <div>
          <h3 className="text-[15px] font-medium" style={{ color: 'var(--color-text-primary)' }}>{name}</h3>
          {description && (
            <p className="text-[13px] mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{description}</p>
          )}
        </div>
      </div>
      <div className="text-right">
        <p className="text-[13px] font-medium" style={{ color: 'var(--color-text-primary)' }}>{dealCount} deals</p>
        <p className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>{formatDate(createdAt)}</p>
      </div>
    </div>
  )

  if (isDisabled) {
    return (
      <div className="relative group w-full">
        <div
          className="block p-5 rounded-lg border opacity-60 cursor-not-allowed select-none"
          style={{
            background: 'var(--color-surface-0)',
            borderColor: 'var(--color-surface-2)',
          }}
        >
          {cardContent}
        </div>
        
        {/* Stylized Tooltip with Micro-animation */}
        <div
          className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 text-[11px] font-medium rounded-md shadow-md whitespace-nowrap z-50 transition-all duration-150 scale-95 opacity-0 group-hover:opacity-100 group-hover:scale-100"
          style={{
            background: 'var(--color-text-primary)',
            color: 'var(--color-text-inverse)',
            border: '1px solid var(--color-surface-3)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          Add deal(s) to the portfolio first
          {/* Arrow */}
          <div
            className="absolute top-full left-1/2 -translate-x-1/2 border-[4px] border-transparent"
            style={{
              borderTopColor: 'var(--color-text-primary)',
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <Link
      href={href}
      className="block p-5 rounded-lg border transition-colors hover:shadow-sm"
      style={{
        background: 'var(--color-surface-0)',
        borderColor: 'var(--color-surface-2)',
      }}
    >
      {cardContent}
    </Link>
  )
}
