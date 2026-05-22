'use client'

import { useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { DataGrid, type ColumnDef } from '@/components/shared/DataGrid'
import { DealScoreBadge } from './DealScoreBadge'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

interface UnderwritingRow {
  underwritability_status: string | null
  asking_price: number | null
  price_per_unit: number | null
  population_1mi: number | null
  population_growth_pct: number | null
  rent_growth_12mo_pct: number | null
  rent_growth_fwd_pct: number | null
  vacancy_rate_pct: number | null
  market_price_per_unit: number | null
  delta_pct: number | null
  cap_rate: number | null
  purchase_price: number | null
  purchase_price_per_unit: number | null
  capex: number | null
  irr_pct: number | null
  equity_multiple: number | null
  cash_on_cash_pct: number | null
  profit: number | null
  occupancy_pct: number | null
  proceed_with_loi: boolean | null
  sale_rent_comps: string | null
}

interface LoiRecord {
  outcome: string
  insurance_declarations: boolean
  vendor_service_contracts: boolean
  utility_bills: boolean
  email_for_loi: string | null
  last_email_for_loi_sent_on: string | null
}

interface DocItem {
  doc_name: string | null
  collected: boolean
  metadata: Record<string, unknown> | null
}

export interface Deal {
  id: string
  stage: string
  score: string | null
  created_at: string
  last_email_sent_on: string | null
  response_type: string | null
  campaigns: { name: string; market: string } | null
  portfolios?: { id: string; name: string } | null
  deal_fields?: { value: string | null; field_definitions: { key: string; label: string; data_type: string } | null }[] | null
  underwriting?: UnderwritingRow[] | null
  loi_records?: LoiRecord[] | null
  document_checklist?: DocItem[] | null
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
  view?: 'leads' | 'deals'
  selectedRowIds?: Set<string>
  onSelectionChange?: (ids: Set<string>) => void
  emptyAction?: { label: string; onClick: () => void }
  maxHeight?: number | string
  fillHeight?: boolean
  className?: string
  totalRows?: number
  page?: number
  pageSize?: number
  onPageChange?: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  selectionActions?: { id: string; icon: React.ReactNode; label: string; onClick: (ids: string[]) => void }[]
  selectionMenuActions?: { id: string; label: string; onClick: (ids: string[]) => void }[]
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

function getDocValue(docs: DocItem[] | null | undefined, docName: string): string {
  const doc = docs?.find((d) => d.doc_name === docName)
  if (!doc) return '—'
  return doc.collected ? 'Yes' : '—'
}

function getDocMeta(docs: DocItem[] | null | undefined, docName: string, metaKey: string): string {
  const doc = docs?.find((d) => d.doc_name === docName)
  if (!doc?.collected) return '—'
  const meta = doc.metadata as Record<string, unknown> | null | undefined
  if (!meta) return '—'
  return String(meta[metaKey] ?? '—')
}

function getDocCount(docs: DocItem[] | null | undefined, prefix: string): string {
  const count = docs?.filter((d) => d.doc_name?.startsWith(prefix) && d.collected).length ?? 0
  return String(count)
}

function fmtNum(val: number | null | undefined): string {
  if (val == null) return '—'
  return val.toLocaleString()
}

function fmtPct(val: number | null | undefined): string {
  if (val == null) return '—'
  return `${(val * 100).toFixed(1)}%`
}

function fmtCurrency(val: number | null | undefined): string {
  if (val == null) return '—'
  return `$${val.toLocaleString()}`
}

function fmtBool(val: boolean | null | undefined): string {
  if (val == null) return '—'
  return val ? 'Yes' : 'No'
}

export function DealTable({
  deals, loading, fieldDefs, view = 'leads',
  selectedRowIds, onSelectionChange, emptyAction, maxHeight, fillHeight, className,
  totalRows, page, pageSize, onPageChange, onPageSizeChange,
  selectionActions, selectionMenuActions, topToolbar, filters,
  activeFilterCount, onClearFilters, allRowsSelected, onSelectAll,
  serverSide, serverSortKey, serverSortDir, onSortChange,
  columnOrderStorageKey, onRowClick,
}: DealTableProps) {
  const router = useRouter()

  const getFieldValue = useCallback((deal: Deal, key: string): string => {
    const f = deal.deal_fields?.find((df) => df?.field_definitions?.key === key)
    return f?.value ?? ''
  }, [])

  const columns = useMemo((): ColumnDef<Deal>[] => {
    const cols: ColumnDef<Deal>[] = []

    // ── Leads base columns ──────────────────────────────────────
    cols.push({
      key: 'stage', header: 'Stage', minWidth: 120, sortable: true, editable: false,
      render: (r) => (
        <Badge variant={stageBadgeVariant[r.stage] ?? 'neutral'} size="sm">
          {r.stage.replace(/_/g, ' ')}
        </Badge>
      ),
    })

    cols.push({
      key: 'portfolio', header: 'Portfolio', minWidth: 120, sortable: true, editable: false,
      accessor: (r) => r.portfolios?.name ?? '',
      render: (r) => <span style={{ color: 'var(--color-text-secondary)' }}>{r.portfolios?.name ?? '—'}</span>,
    })

    cols.push({
      key: 'created_at', header: 'Date Added', width: 110, sortable: true, editable: false,
      accessor: (r) => r.created_at,
      render: (r) => (
        <span style={{ color: 'var(--color-text-tertiary)', fontSize: 12, fontFamily: 'var(--font-jetbrains-mono)' }}>
          {formatDate(r.created_at)}
        </span>
      ),
    })

    cols.push({
      key: 'last_email_sent_on', header: 'Last Email Sent On', width: 130, sortable: true, editable: false,
      accessor: (r) => r.last_email_sent_on ?? '',
      render: (r) => (
        <span style={{ color: 'var(--color-text-tertiary)', fontSize: 12, fontFamily: 'var(--font-jetbrains-mono)' }}>
          {r.last_email_sent_on ? formatDate(r.last_email_sent_on) : '—'}
        </span>
      ),
    })

    cols.push({
      key: 'response_type', header: 'Response Type', minWidth: 130, sortable: true, editable: false,
      accessor: (r) => r.response_type ?? '',
      render: (r) => (
        <span style={{ color: 'var(--color-text-secondary)' }}>{r.response_type || '—'}</span>
      ),
    })

    // ── Dynamic columns from field_definitions ───────────────────
    if (fieldDefs) {
      for (const fd of fieldDefs) {
        if (!fd.show_in_grid) continue
        cols.push({
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

    // ── Deals-only columns ───────────────────────────────────────
    if (view === 'deals') {
      const uw = (r: Deal): UnderwritingRow | null => r.underwriting?.[0] ?? null
      const loi = (r: Deal): LoiRecord | null => r.loi_records?.[0] ?? null
      const docs = (r: Deal): DocItem[] | null | undefined => r.document_checklist

      // Document Inventory
      const docCols: ColumnDef<Deal>[] = [
        { key: 'doc_pl', header: 'P&L', width: 80, sortable: false, render: (r) => <span style={{ color: 'var(--color-text-secondary)' }}>{getDocValue(docs(r), 'P&L')}</span> },
        { key: 'doc_pl_date', header: 'P&L Date', width: 90, sortable: false, render: (r) => <span style={{ color: 'var(--color-text-tertiary)', fontSize: 12 }}>{getDocMeta(docs(r), 'P&L', 'doc_date')}</span> },
        { key: 'doc_rr', header: 'Rent Roll', width: 85, sortable: false, render: (r) => <span style={{ color: 'var(--color-text-secondary)' }}>{getDocValue(docs(r), 'Rent Roll')}</span> },
        { key: 'doc_rr_date', header: 'Rent Roll Date', width: 100, sortable: false, render: (r) => <span style={{ color: 'var(--color-text-tertiary)', fontSize: 12 }}>{getDocMeta(docs(r), 'Rent Roll', 'doc_date')}</span> },
        { key: 'doc_om', header: 'OM', width: 70, sortable: false, render: (r) => <span style={{ color: 'var(--color-text-secondary)' }}>{getDocValue(docs(r), 'Offering Memorandum (OM)')}</span> },
        { key: 'doc_taxbill', header: 'Tax Bill', width: 80, sortable: false, render: (r) => <span style={{ color: 'var(--color-text-secondary)' }}>{getDocValue(docs(r), 'Tax Bill')}</span> },
        { key: 'doc_capex', header: 'CAPEX', width: 80, sortable: false, render: (r) => <span style={{ color: 'var(--color-text-secondary)' }}>{getDocValue(docs(r), 'CAPEX Schedule')}</span> },
        { key: 'doc_mr', header: 'Market Reports', width: 100, sortable: false, render: (r) => <span style={{ color: 'var(--color-text-secondary)' }}>{getDocCount(docs(r), 'Market Report')}/4</span> },
        { key: 'doc_drlink', header: 'Deal Room Link', minWidth: 130, sortable: false, render: (r) => {
          const link = getDocMeta(docs(r), 'Deal Room Link', 'link')
          if (link === '—') return <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
          return <a href={link} target="_blank" rel="noreferrer" className="text-[11px] underline" style={{ color: 'var(--color-accent)' }}>Open</a>
        }},
      ]
      for (const c of docCols) cols.push(c)

      // Evaluate Underwritability
      const evalCols: ColumnDef<Deal>[] = [
        { key: 'uw_ask_price', header: 'Asking Price', width: 110, align: 'right', sortable: false, render: (r) => <span className="tabular-nums" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtCurrency(uw(r)?.asking_price)}</span> },
        { key: 'uw_ppu_eval', header: 'Price/Unit', width: 90, align: 'right', sortable: false, render: (r) => <span className="tabular-nums" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtCurrency(uw(r)?.price_per_unit)}</span> },
        { key: 'uw_pop1', header: 'Population (1-Mile)', width: 120, align: 'right', sortable: false, render: (r) => <span className="tabular-nums" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtNum(uw(r)?.population_1mi)}</span> },
        { key: 'uw_popgr', header: 'Population Growth %', width: 130, align: 'right', sortable: false, render: (r) => <span className="tabular-nums" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtPct(uw(r)?.population_growth_pct)}</span> },
        { key: 'uw_rg12', header: 'Rent Growth % (12 Mo)', width: 135, align: 'right', sortable: false, render: (r) => <span className="tabular-nums" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtPct(uw(r)?.rent_growth_12mo_pct)}</span> },
        { key: 'uw_rgfwd', header: 'Rent Growth % (Forecast)', width: 140, align: 'right', sortable: false, render: (r) => <span className="tabular-nums" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtPct(uw(r)?.rent_growth_fwd_pct)}</span> },
        { key: 'uw_vac', header: 'Vacancy Rate %', width: 110, align: 'right', sortable: false, render: (r) => <span className="tabular-nums" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtPct(uw(r)?.vacancy_rate_pct)}</span> },
        { key: 'uw_mppu', header: 'Market Price/Unit', width: 120, align: 'right', sortable: false, render: (r) => <span className="tabular-nums" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtCurrency(uw(r)?.market_price_per_unit)}</span> },
        { key: 'uw_delta', header: 'Delta %', width: 90, align: 'right', sortable: false, render: (r) => <span className="tabular-nums" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtPct(uw(r)?.delta_pct)}</span> },
        { key: 'uw_caprate', header: 'Cap Rate', width: 90, align: 'right', sortable: false, render: (r) => <span className="tabular-nums" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtPct(uw(r)?.cap_rate)}</span> },
        { key: 'uw_underwritable', header: 'Underwritable?', width: 110, sortable: false, render: (r) => {
          const s = uw(r)?.underwritability_status
          if (!s) return <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
          return <Badge variant={s === 'go' ? 'success' : s === 'no_go' ? 'neutral' : 'warning'} size="sm">{s === 'go' ? 'Yes' : s === 'no_go' ? 'No' : 'Maybe'}</Badge>
        }},
        { key: 'uw_comps', header: 'Sale & Rent Comps', minWidth: 140, sortable: false, render: (r) => <span style={{ color: 'var(--color-text-secondary)' }}>{uw(r)?.sale_rent_comps || '—'}</span> },
      ]
      for (const c of evalCols) cols.push(c)

      // Underwriting Summary
      const summaryCols: ColumnDef<Deal>[] = [
        { key: 'uws_ask', header: 'Asking Price', width: 110, align: 'right', sortable: false, render: (r) => <span className="tabular-nums" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtCurrency(uw(r)?.asking_price)}</span> },
        { key: 'uws_ppu', header: 'Price/Unit', width: 90, align: 'right', sortable: false, render: (r) => <span className="tabular-nums" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtCurrency(uw(r)?.price_per_unit)}</span> },
        { key: 'uws_pur', header: 'Purchase Price', width: 120, align: 'right', sortable: false, render: (r) => <span className="tabular-nums" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtCurrency(uw(r)?.purchase_price)}</span> },
        { key: 'uws_ppu2', header: 'Price/Unit', width: 90, align: 'right', sortable: false, render: (r) => <span className="tabular-nums" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtCurrency(uw(r)?.purchase_price_per_unit)}</span> },
        { key: 'uws_capex', header: 'CAPEX', width: 90, align: 'right', sortable: false, render: (r) => <span className="tabular-nums" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtCurrency(uw(r)?.capex)}</span> },
        { key: 'uws_occ', header: 'Occupancy %', width: 100, align: 'right', sortable: false, render: (r) => <span className="tabular-nums" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtPct(uw(r)?.occupancy_pct)}</span> },
        { key: 'uws_irr', header: 'IRR', width: 70, align: 'right', sortable: false, render: (r) => <span className="tabular-nums" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtPct(uw(r)?.irr_pct)}</span> },
        { key: 'uws_em', header: 'EM', width: 70, align: 'right', sortable: false, render: (r) => <span className="tabular-nums" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-jetbrains-mono)' }}>{uw(r)?.equity_multiple != null ? uw(r)!.equity_multiple!.toFixed(2) : '—'}</span> },
        { key: 'uws_coc', header: 'CoC', width: 70, align: 'right', sortable: false, render: (r) => <span className="tabular-nums" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtPct(uw(r)?.cash_on_cash_pct)}</span> },
        { key: 'uws_profit', header: 'Profit', width: 90, align: 'right', sortable: false, render: (r) => <span className="tabular-nums" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtCurrency(uw(r)?.profit)}</span> },
        { key: 'uws_loi', header: 'Proceed with LOI?', width: 130, sortable: false, render: (r) => <span style={{ color: 'var(--color-text-secondary)' }}>{fmtBool(uw(r)?.proceed_with_loi)}</span> },
      ]
      for (const c of summaryCols) cols.push(c)

      // LOI Related
      const loiCols: ColumnDef<Deal>[] = [
        { key: 'loi_ins', header: 'Insurance Declarations', minWidth: 140, sortable: false, render: (r) => <span style={{ color: 'var(--color-text-secondary)' }}>{fmtBool(loi(r)?.insurance_declarations)}</span> },
        { key: 'loi_vsc', header: 'Vendor/Service Contracts', minWidth: 150, sortable: false, render: (r) => <span style={{ color: 'var(--color-text-secondary)' }}>{fmtBool(loi(r)?.vendor_service_contracts)}</span> },
        { key: 'loi_ub', header: 'Utility Bills', minWidth: 110, sortable: false, render: (r) => <span style={{ color: 'var(--color-text-secondary)' }}>{fmtBool(loi(r)?.utility_bills)}</span> },
        { key: 'loi_email', header: 'Email for LOI', minWidth: 140, sortable: false, render: (r) => <span style={{ color: 'var(--color-text-secondary)' }}>{loi(r)?.email_for_loi || '—'}</span> },
        { key: 'loi_lasent', header: 'Last Email for LOI Sent On', width: 150, sortable: false, render: (r) => (
          <span style={{ color: 'var(--color-text-tertiary)', fontSize: 12, fontFamily: 'var(--font-jetbrains-mono)' }}>
            {loi(r)?.last_email_for_loi_sent_on ? formatDate(loi(r)!.last_email_for_loi_sent_on!) : '—'}
          </span>
        )},
        { key: 'loi_status', header: 'LOI Status', width: 110, sortable: false, render: (r) => {
          const status = loi(r)?.outcome
          if (!status) return <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
          return <Badge variant={status === 'deal_reached' ? 'success' : status === 'fallen_through' ? 'neutral' : 'warning'} size="sm">{status.replace(/_/g, ' ')}</Badge>
        }},
      ]
      for (const c of loiCols) cols.push(c)
    }

    return cols
  }, [fieldDefs, getFieldValue, view])

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
