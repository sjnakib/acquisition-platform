'use client'

import { useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { DataGrid, type ColumnDef } from '@/components/shared/DataGrid'
import { DealScoreBadge } from './DealScoreBadge'
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
  maxHeight?: number | string
  fillHeight?: boolean
  className?: string
  // Pagination (built into DataGrid toolbar)
  totalRows?: number
  page?: number
  pageSize?: number
  onPageChange?: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  // Selection toolbar actions
  selectionActions?: { id: string; icon: React.ReactNode; label: string; onClick: (ids: string[]) => void }[]
  selectionMenuActions?: { id: string; label: string; onClick: (ids: string[]) => void }[]
  // Top toolbar
  topToolbar?: {
    recordLabel?: string
    onAdd?: () => void
    onDelete?: (ids: string[]) => void
    actions?: { id: string; icon: React.ReactNode; label: string; onClick: () => void }[]
    menuActions?: { id: string; label: string; onClick: () => void }[]
    searchValue?: string
    onSearchChange?: (value: string) => void
    searchPlaceholder?: string
  }
  filters?: { id: string; label: string; options: { value: string; label: string }[]; value: string | null; onChange: (value: string | null) => void }[]
  activeFilterCount?: number
  onClearFilters?: () => void
  allRowsSelected?: boolean
  onSelectAll?: () => void
  serverSide?: boolean
  serverSortKey?: string | null
  serverSortDir?: 'asc' | 'desc'
  onSortChange?: (key: string, dir: 'asc' | 'desc') => void
  columnOrderStorageKey?: string
  onRowClick?: (row: Deal) => void
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

export function DealTable({ deals, loading, fieldDefs, selectedRowIds, onSelectionChange, emptyAction, maxHeight, fillHeight, className, totalRows, page, pageSize, onPageChange, onPageSizeChange, selectionActions, selectionMenuActions, topToolbar, filters, activeFilterCount, onClearFilters, allRowsSelected, onSelectAll, serverSide, serverSortKey, serverSortDir, onSortChange, columnOrderStorageKey, onRowClick }: DealTableProps) {
  const router = useRouter()

  const getFieldValue = useCallback((deal: Deal, key: string): string => {
    const f = deal.deal_fields?.find(df => df?.field_definitions?.key === key)
    return f?.value ?? ''
  }, [])

  const columns = useMemo((): ColumnDef<Deal>[] => {
    const base: ColumnDef<Deal>[] = [
      { key: 'deal_name', header: 'Deal Name', minWidth: 140, sortable: true, editable: true,
        accessor: (r) => r.deal_name ?? 'Untitled',
        render: (r) => <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{r.deal_name ?? 'Untitled'}</span> },
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
      { key: 'portfolio', header: 'Portfolio', minWidth: 120, sortable: true, editable: false,
        accessor: (r) => r.portfolios?.name ?? '',
        render: (r) => <span style={{ color: 'var(--color-text-secondary)' }}>{r.portfolios?.name ?? '—'}</span> },
      { key: 'created_at', header: 'Date Added', width: 110, sortable: true, editable: false,
        accessor: (r) => r.created_at,
        render: (r) => <span style={{ color: 'var(--color-text-tertiary)', fontSize: 12, fontFamily: 'var(--font-jetbrains-mono)' }}>{formatDate(r.created_at)}</span> },
    ]

    // Dynamic columns from field_definitions — respect show_in_grid flag
    if (fieldDefs) {
      for (const fd of fieldDefs) {
        if (!fd.show_in_grid) continue
        base.push({
          key: fd.key,
          header: fd.label,
          minWidth: 120,
          sortable: true,
          editable: true,
          accessor: (r) => getFieldValue(r, fd.key),
          render: (r) => {
            const val = getFieldValue(r, fd.key)
            return <span style={{ color: 'var(--color-text-secondary)' }}>{val || '—'}</span>
          },
        })
      }
    }

    return base
  }, [fieldDefs, getFieldValue])

  return (
    <DataGrid
      data={deals}
      columns={columns}
      loading={loading}
      rowKey={(r) => r.id}
      onRowClick={onRowClick ?? ((r) => router.push(`/deals/${r.id}`))}
      selectedRowIds={selectedRowIds}
      onSelectionChange={onSelectionChange}
      emptyAction={emptyAction}
      maxHeight={maxHeight}
      fillHeight={fillHeight}
      className={className}
      totalRows={totalRows}
      page={page}
      pageSize={pageSize}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      selectionActions={selectionActions}
      selectionMenuActions={selectionMenuActions}
      topToolbar={topToolbar}
      filters={filters}
      activeFilterCount={activeFilterCount}
      onClearFilters={onClearFilters}
      allRowsSelected={allRowsSelected}
      onSelectAll={onSelectAll}
      serverSide={serverSide}
      serverSortKey={serverSortKey}
      serverSortDir={serverSortDir}
      onSortChange={onSortChange}
      columnOrderStorageKey={columnOrderStorageKey}
    />
  )
}
