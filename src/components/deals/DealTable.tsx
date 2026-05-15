'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal } from 'lucide-react'
import { DataGrid, type ColumnDef } from '@/components/shared/DataGrid'
import { DealScoreBadge } from './DealScoreBadge'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

interface Deal {
  id: string
  deal_name: string | null
  address: string | null
  city: string | null
  state: string | null
  unit_count: number | null
  stage: string
  score: string | null
  created_at: string
  campaigns: { name: string; market: string } | null
}

interface DealTableProps {
  deals: Deal[]
  loading?: boolean
  onArchive?: (id: string) => void
  onDelete?: (id: string) => void
}

const stageBadgeVariant: Record<string, 'neutral' | 'info' | 'warning' | 'accent' | 'success'> = {
  lead: 'neutral',
  outreach: 'info',
  response: 'info',
  document_collection: 'warning',
  underwritability_review: 'warning',
  underwriting: 'warning',
  scored: 'accent',
  call_scheduled: 'info',
  loi: 'accent',
  closed: 'success',
  archived: 'neutral',
}

const columns: ColumnDef<Deal>[] = [
  { key: 'deal_name', header: 'Property Name', minWidth: 140, sortable: true,
    accessor: (r) => r.deal_name ?? 'Untitled',
    render: (r) => <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{r.deal_name ?? 'Untitled'}</span> },
  { key: 'address', header: 'Address', minWidth: 160, sortable: true,
    accessor: (r) => [r.address, r.city, r.state].filter(Boolean).join(', '),
    render: (r) => <span style={{ color: 'var(--color-text-secondary)' }}>{[r.address, r.city, r.state].filter(Boolean).join(', ') || '—'}</span> },
  { key: 'unit_count', header: 'Units', align: 'right', width: 80, sortable: true,
    accessor: (r) => r.unit_count ?? 0,
    render: (r) => <span className="tabular-nums" style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>{r.unit_count ?? '—'}</span> },
  { key: 'stage', header: 'Stage', minWidth: 120, sortable: true,
    render: (r) => (
      <Badge variant={stageBadgeVariant[r.stage] ?? 'neutral'} size="sm">
        {r.stage.replace(/_/g, ' ')}
      </Badge>
    )},
  { key: 'score', header: 'Score', width: 100, sortable: true,
    render: (r) => <DealScoreBadge score={r.score} /> },
  { key: 'campaign', header: 'Campaign', minWidth: 120, sortable: true,
    accessor: (r) => r.campaigns?.name ?? '',
    render: (r) => <span style={{ color: 'var(--color-text-secondary)' }}>{r.campaigns?.name ?? '—'}</span> },
  { key: 'created_at', header: 'Date Added', width: 110, sortable: true,
    accessor: (r) => r.created_at,
    render: (r) => <span style={{ color: 'var(--color-text-tertiary)', fontSize: 12, fontFamily: 'var(--font-jetbrains-mono)' }}>{formatDate(r.created_at)}</span> },
];

export function DealTable({ deals, loading, onArchive, onDelete }: DealTableProps) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  const actionColumn: ColumnDef<Deal> = {
    key: 'actions', header: '', width: 48, sortable: false,
    render: (r) => (
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setMenuOpen(menuOpen === r.id ? null : r.id)}
          style={{ color: 'var(--color-text-tertiary)' }}
          className="hover:opacity-70 transition-opacity"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {menuOpen === r.id && (
          <div
            className="absolute right-0 top-full mt-1 w-36 rounded-lg shadow-lg py-1 z-10"
            style={{ background: 'var(--color-surface-0)', border: '1px solid var(--color-surface-3)', boxShadow: 'var(--shadow-lg)' }}
          >
            <button
              onClick={() => { router.push(`/deals/${r.id}`); setMenuOpen(null) }}
              className="w-full text-left px-3 py-2 text-[13px] transition-colors"
              style={{ color: 'var(--color-text-primary)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-1)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              View
            </button>
            {onArchive && (
              <button
                onClick={() => { onArchive(r.id); setMenuOpen(null) }}
                className="w-full text-left px-3 py-2 text-[13px] transition-colors"
                style={{ color: 'var(--color-text-primary)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-1)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                Archive
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => { onDelete(r.id); setMenuOpen(null) }}
                className="w-full text-left px-3 py-2 text-[13px] transition-colors"
                style={{ color: 'var(--color-danger-text)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-danger-bg)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    ),
  };

  const allColumns = onArchive || onDelete ? [...columns, actionColumn] : columns;

  return (
    <DataGrid
      columns={allColumns}
      data={deals as Deal[]}
      rowKey={(r) => r.id}
      onRowClick={(r) => router.push(`/deals/${r.id}`)}
      loading={loading}
      emptyMessage="No deals found"
      maxHeight="calc(100vh - 260px)"
    />
  )
}
