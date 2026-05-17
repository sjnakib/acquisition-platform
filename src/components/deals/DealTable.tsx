'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { DataGrid, type ColumnDef } from '@/components/shared/DataGrid'
import { DealScoreBadge } from './DealScoreBadge'
import { CampaignEditPopover } from './CampaignEditPopover'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

interface Deal {
  id: string
  deal_name: string | null
  unit_count: number | null
  stage: string
  score: string | null
  created_at: string
  campaigns: { name: string; market: string } | null
  portfolios?: { id: string; name: string } | null
  deal_fields?: { value: string | null; field_definitions: { key: string; label: string; data_type: string } | null }[] | null
}

interface FieldDef {
  id: string
  key: string
  label: string
  data_type: string
  show_in_grid: boolean
  sort_order: number
}

interface DealTableProps {
  deals: Deal[]
  loading?: boolean
  fieldDefs?: FieldDef[]
  onArchive?: (id: string) => void
  onDelete?: (id: string) => void
  selectedRowIds?: Set<string>
  onSelectionChange?: (ids: Set<string>) => void
  emptyAction?: { label: string; onClick: () => void }
}

const stageBadgeVariant: Record<string, 'neutral' | 'info' | 'warning' | 'accent' | 'success'> = {
  lead: 'neutral',
  outreach: 'info',
  response: 'info',
  underwriting: 'warning',
  loi: 'accent',
  closed: 'success',
  failed: 'neutral',
  archived: 'neutral',
}

const columns: ColumnDef<Deal>[] = [
  { key: 'deal_name', header: 'Property Name', minWidth: 140, sortable: true, editable: true,
    accessor: (r) => r.deal_name ?? 'Untitled',
    render: (r) => <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{r.deal_name ?? 'Untitled'}</span> },
  { key: 'address', header: 'Address', minWidth: 160, sortable: true, editable: true,
    accessor: (r) => [r.address, r.city, r.state].filter(Boolean).join(', '),
    render: (r) => <span style={{ color: 'var(--color-text-secondary)' }}>{[r.address, r.city, r.state].filter(Boolean).join(', ') || '—'}</span> },
  { key: 'unit_count', header: 'Units', align: 'right', width: 80, sortable: true, editable: true,
    accessor: (r) => r.unit_count ?? 0,
    render: (r) => <span className="tabular-nums" style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>{r.unit_count ?? '—'}</span> },
  { key: 'stage', header: 'Stage', minWidth: 120, sortable: true, editable: false,
    render: (r) => (
      <Badge variant={stageBadgeVariant[r.stage] ?? 'neutral'} size="sm">
        {r.stage.replace(/_/g, ' ')}
      </Badge>
    )},
  { key: 'score', header: 'Score', width: 100, sortable: true, editable: false,
    render: (r) => <DealScoreBadge score={r.score} /> },
  { key: 'campaign', header: 'Campaign', minWidth: 120, sortable: true, editable: false,
    accessor: (r) => r.campaigns?.name ?? '',
    render: (r) => <span style={{ color: 'var(--color-text-secondary)' }}>{r.campaigns?.name ?? '—'}</span> },
  { key: 'created_at', header: 'Date Added', width: 110, sortable: true, editable: false,
    accessor: (r) => r.created_at,
    render: (r) => <span style={{ color: 'var(--color-text-tertiary)', fontSize: 12, fontFamily: 'var(--font-jetbrains-mono)' }}>{formatDate(r.created_at)}</span> },
]

const editableColIndices = new Set([0, 1, 2, 5])

export function DealTable({ deals, loading, onArchive, onDelete, selectedRowIds, onSelectionChange, emptyAction }: DealTableProps) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  const actionColumn: ColumnDef<Deal> = {
    key: 'actions', header: '', width: 48, sortable: false, editable: false,
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
  }

  const allColumns = onArchive || onDelete ? [...columns, actionColumn] : columns

  const fieldFromColIndex: Record<number, string> = useMemo(() => ({
    0: 'deal_name',
    1: 'address',
    2: 'unit_count',
    5: 'campaign_id',
  }), [])

  const handleCellEdit = useCallback(async (rowIndex: number, colIndex: number, value: string) => {
    const deal = deals[rowIndex]
    if (!deal) return
    const field = fieldFromColIndex[colIndex]
    if (!field) return

    let parsedValue: string | number | null = value
    if (field === 'unit_count') {
      parsedValue = value ? parseInt(value, 10) : null
      if (parsedValue !== null && (isNaN(parsedValue) || parsedValue < 0)) return
    }

    try {
      const res = await fetch(`/api/deals/${deal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: parsedValue }),
      })
      if (!res.ok) {
        console.error('Failed to update deal:', await res.text())
      }
    } catch (err) {
      console.error('Failed to update deal:', err)
    }
  }, [deals, fieldFromColIndex])

  const handleBulkArchive = useCallback(async () => {
    if (!selectedRowIds || selectedRowIds.size === 0) return
    try {
      const res = await fetch('/api/deals/batch', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: Array.from(selectedRowIds).map((id) => ({
            id,
            field: 'is_archived',
            value: true,
          })),
        }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        console.error('Batch archive failed:', errData)
      }
    } catch (err) {
      console.error('Batch archive error:', err)
    }
    onSelectionChange?.(new Set())
  }, [selectedRowIds, onSelectionChange])

  return (
    <DataGrid
      data={deals}
      columns={columns}
      loading={loading}
      rowKey={(r) => r.id}
      onRowClick={(r) => router.push(`/deals/${r.id}`)}
      loading={loading}
      emptyMessage="No deals found"
      emptyAction={emptyAction}
      maxHeight="calc(100vh - 260px)"
      editableColumns={editableColIndices}
      onCellEdit={handleCellEdit}
      editComponents={{
        5: (props) => <CampaignEditPopover {...props} />,
      }}
      selectedRowIds={selectedRowIds}
      onSelectionChange={onSelectionChange}
      bulkActions={onArchive ? () => (
        <button
          onClick={handleBulkArchive}
          className="text-[12px] font-medium px-3 py-1.5 rounded transition-colors"
          style={{ color: 'var(--color-text-primary)', background: 'var(--color-surface-1)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-2)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-surface-1)' }}
        >
          Archive Selected
        </button>
      ) : undefined}
    />
  )
}
