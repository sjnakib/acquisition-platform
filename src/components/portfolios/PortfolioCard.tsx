import Link from 'next/link'
import { FolderKanban } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface PortfolioCardProps {
  id: string
  name: string
  description: string | null
  dealCount: number
  createdAt: string
}

export function PortfolioCard({ id, name, description, dealCount, createdAt }: PortfolioCardProps) {
  return (
    <Link
      href={`/portfolios/${id}`}
      className="block p-5 rounded-lg border transition-colors hover:shadow-sm"
      style={{
        background: 'var(--color-surface-0)',
        borderColor: 'var(--color-surface-2)',
      }}
    >
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
    </Link>
  )
}
