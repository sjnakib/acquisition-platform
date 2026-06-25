'use client'

import { useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { DataGrid, type ColumnDef } from '@/components/shared/DataGrid'
import { InlineDropdownEditor } from '@/components/shared/InlineDropdownEditor'
import { Badge } from '@/components/ui/badge'
import { Tooltip } from '@/components/ui/tooltip'
import { formatDate, REQUIRED_DEAL_FIELDS } from '@/lib/utils'
import { DEAL_STAGES } from '@/lib/stage-machine'

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
  loi_recommendation: boolean | null
}

interface LoiRecord {
  outcome: string
  loi_email: string | null
  last_loi_email_sent_at: string | null
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
  drive_file_count?: number | null
  drive_folder_url?: string | null
  outreach_emails: string[] | null
  campaign_id?: string
  project_id?: string
  campaigns: { name: string; market: string } | null
  portfolios?: { id: string; name: string } | null
  has_pending_review?: boolean
  pending_review_thread_id?: string | null
  pending_review_count?: number
  deal_fields?: { value: string | null; field_definitions: { key: string; label: string; data_type: string } | null }[] | null
  underwriting?: UnderwritingRow | UnderwritingRow[] | null
  loi_records?: LoiRecord | LoiRecord[] | null
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
  portfolios?: { id: string; name: string }[]
  view?: 'leads' | 'deals' | 'archived'
  selectedRowIds?: Set<string>
  onSelectionChange?: (ids: Set<string>) => void
  emptyAction?: { label: string; onClick: () => void }
  maxHeight?: number | string
  fillHeight?: boolean
  projectId?: string
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
  /** When false, all columns are non-editable. Default true. */
  editable?: boolean
  /** Column keys to exclude from the grid. E.g. ['portfolio'] for portfolio views. */
  excludeColumns?: string[]
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

const RESPONSE_TYPES = [
  'Interested',
  'Not Interested',
  'Wrong Contact',
  'Do Not Contact',
  'In Discussion',
  'Callback Requested',
  'No Response',
]

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
  deals, loading, fieldDefs, portfolios,
  selectedRowIds, onSelectionChange, emptyAction, maxHeight, fillHeight, projectId, className,
  totalRows, page, pageSize, onPageChange, onPageSizeChange,
  selectionActions, selectionMenuActions, topToolbar, filters,
  activeFilterCount, onClearFilters, allRowsSelected, onSelectAll,
  serverSide, serverSortKey, serverSortDir, onSortChange,
  columnOrderStorageKey, onRowClick, editable = true,
  excludeColumns,
}: DealTableProps) {
  const router = useRouter()

  const getFieldValue = useCallback((deal: Deal, key: string): string => {
    const f = deal.deal_fields?.find((df) => df?.field_definitions?.key === key)
    return f?.value ?? ''
  }, [])

  const columns = useMemo((): ColumnDef<Deal>[] => {
    const cols: ColumnDef<Deal>[] = []

    const fixedSystemKeys = new Set([
      'stage', 'portfolio', 'created_at', 'last_email_sent_on', 'response_type', 'campaign', 'score',
      'outreach_emails',
    ])

    const excludeSet = new Set(excludeColumns ?? [])

    // ── Dynamic columns from field_definitions (left of Stage) ────
    if (fieldDefs) {
      for (const fd of fieldDefs) {
        if (!fd.show_in_grid || fixedSystemKeys.has(fd.key) || excludeSet.has(fd.key)) continue
        cols.push({
          key: fd.key,
          header: fd.label,
          minWidth: 120,
          sortable: true,
          editable,
          isRequired: REQUIRED_DEAL_FIELDS.has(fd.key),
          accessor: (r) => getFieldValue(r, fd.key),
          render: (r) => {
            const val = getFieldValue(r, fd.key)
            return <span style={{ color: 'var(--color-text-secondary)' }}>{val || '—'}</span>
          },
        })
      }
    }

    // ── Fixed system columns ──────────────────────────────────────

    // Email Targets — stored as text[] on the deals table, populated during import.
    // Truncated to first email + "+N more" badge. Tooltip shows all addresses on hover.
    cols.push({
      key: 'outreach_emails', header: 'Email Targets', minWidth: 160, sortable: false, editable: false, isRequired: true,
      accessor: (r) => (r.outreach_emails ?? []).join(', '),
      render: (r) => {
        const emails = r.outreach_emails
        if (!emails || emails.length === 0) {
          return <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
        }
        // Wrap entire cell content so hovering anywhere reveals the full list
        return (
          <Tooltip
            position="bottom"
            className="min-w-0 overflow-hidden"
            content={
              <div className="flex flex-col gap-0.5 max-w-[300px] whitespace-normal">
                {emails.map((email) => (
                  <span key={email} className="break-all">{email}</span>
                ))}
              </div>
            }
          >
            {emails.length === 1 ? (
              <span className="truncate text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>{emails[0]}</span>
            ) : (
              <div className="flex items-center gap-1 min-w-0 text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
                <span className="truncate">{emails[0]}</span>
                <span
                  className="flex-shrink-0 cursor-default select-none rounded px-1 py-px text-[11px] font-medium"
                  style={{
                    background: 'var(--color-surface-2)',
                    color: 'var(--color-text-tertiary)',
                  }}
                >
                  +{emails.length - 1} more
                </span>
              </div>
            )}
          </Tooltip>
        )
      },
    })

    cols.push({
      key: 'stage', header: 'Stage', minWidth: 140, sortable: true, editable,
      accessor: (r) => r.stage,
      render: (r) => {
        const pendingThread = r.has_pending_review ? r.pending_review_thread_id : null
        const resolvedProjectId = projectId || r.project_id
        const reviewUrl = pendingThread && resolvedProjectId
          ? r.campaign_id
            ? `/projects/${resolvedProjectId}/campaigns/${r.campaign_id}?tab=emails&reviewThread=${pendingThread}`
            : `/projects/${resolvedProjectId}/deals/${r.id}?tab=emails&reviewThread=${pendingThread}`
          : null

        return (
          <div className="flex items-center justify-between w-full gap-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <Badge variant={stageBadgeVariant[r.stage] ?? 'neutral'} size="sm">
                {r.stage.replace(/_/g, ' ')}
              </Badge>
               {r.has_pending_review && (
                <span
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (reviewUrl) router.push(reviewUrl)
                  }}
                  title={reviewUrl ? 'Review pending replies' : 'Pending review'}
                >
                  <Badge variant="warning" size="sm">
                    Reply Pending {r.pending_review_count && r.pending_review_count > 1 ? `(${r.pending_review_count})` : ''}
                  </Badge>
                </span>
              )}
            </div>
            <ChevronDown className="h-3 w-3 flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
          </div>
        )
      },
      onSave: async (r, value) => {
        const res = await fetch(`/api/deals/${r.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage: value }),
        })
        if (!res.ok) throw new Error(((await res.json()).error) ?? 'Save failed')
        r.stage = value
      },
    })

    cols.push({
      key: 'portfolio', header: 'Portfolio', minWidth: 120, sortable: true, editable,
      accessor: (r) => r.portfolios?.id ?? '',
      render: (r) => (
        <div className="flex items-center justify-between w-full gap-1">
          <span className="truncate" style={{ color: 'var(--color-text-secondary)' }}>{r.portfolios?.name ?? '—'}</span>
          <ChevronDown className="h-3 w-3 flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
        </div>
      ),
      onSave: async (r, value) => {
        const res = await fetch(`/api/deals/${r.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ portfolio_id: value || null }),
        })
        if (!res.ok) throw new Error(((await res.json()).error) ?? 'Save failed')
        const p = portfolios?.find(p => p.id === value)
        if (r.portfolios) { r.portfolios.id = value; r.portfolios.name = p?.name ?? '' }
        else if (p) { r.portfolios = { id: value, name: p.name } }
      },
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
      key: 'response_type', header: 'Response Type', minWidth: 130, sortable: true, editable,
      accessor: (r) => r.response_type ?? '',
      render: (r) => (
        <div className="flex items-center justify-between w-full gap-1">
          <span className="truncate" style={{ color: 'var(--color-text-secondary)' }}>{r.response_type || '—'}</span>
          <ChevronDown className="h-3 w-3 flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
        </div>
      ),
      onSave: async (r, value) => {
        const res = await fetch(`/api/deals/${r.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ response_type: value || null }),
        })
        if (!res.ok) throw new Error(((await res.json()).error) ?? 'Save failed')
        r.response_type = value || null
      },
    })

    cols.push({
      key: 'drive_file_count', header: 'Docs in Deal Room', width: 130, align: 'right', sortable: false, editable: false,
      accessor: (r) => String(r.drive_file_count ?? 0),
      render: (r) => (
        <span className="tabular-nums" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-jetbrains-mono)' }}>
          {r.drive_file_count ?? 0}
        </span>
      ),
    })

    cols.push({
      key: 'drive_folder_url', header: 'Deal Room Link', minWidth: 130, sortable: false, editable: false,
      accessor: (r) => r.drive_folder_url ?? '',
      render: (r) => {
        if (!r.drive_folder_url) return <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
        return (
          <a
            href={r.drive_folder_url}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] underline"
            style={{ color: 'var(--color-accent)' }}
            onClick={(e) => e.stopPropagation()}
          >
            Open
          </a>
        )
      },
    })

    // ── Underwriting & LOI columns (all views) ────────────────────
    // Supabase returns one-to-one relationships (unique FK) as a single object,
    // not an array. Handle both formats defensively.
    const uw = (r: Deal): UnderwritingRow | null => {
      const u = r.underwriting
      if (!u) return null
      return Array.isArray(u) ? (u[0] ?? null) : u
    }
    const loi = (r: Deal): LoiRecord | null => {
      const l = r.loi_records
      if (!l) return null
      return Array.isArray(l) ? (l[0] ?? null) : l
    }

    // Evaluate Underwritability (Deal Room tab fields)
    const evalCols: ColumnDef<Deal>[] = [
      { key: 'uw_ask_price', header: 'Asking Price', width: 110, align: 'right', sortable: false, editable: false, render: (r) => <span className="tabular-nums" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtCurrency(uw(r)?.asking_price)}</span> },
      { key: 'uw_ppu_eval', header: 'Price/Unit', width: 90, align: 'right', sortable: false, editable: false, render: (r) => <span className="tabular-nums" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtCurrency(uw(r)?.price_per_unit)}</span> },
      { key: 'uw_pop1', header: 'Population (1-Mile)', width: 120, align: 'right', sortable: false, editable: false, render: (r) => <span className="tabular-nums" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtNum(uw(r)?.population_1mi)}</span> },
      { key: 'uw_popgr', header: 'Population Growth %', width: 130, align: 'right', sortable: false, editable: false, render: (r) => <span className="tabular-nums" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtPct(uw(r)?.population_growth_pct)}</span> },
      { key: 'uw_rg12', header: 'Rent Growth % (12 Mo)', width: 135, align: 'right', sortable: false, editable: false, render: (r) => <span className="tabular-nums" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtPct(uw(r)?.rent_growth_12mo_pct)}</span> },
      { key: 'uw_rgfwd', header: 'Rent Growth % (Forecast)', width: 140, align: 'right', sortable: false, editable: false, render: (r) => <span className="tabular-nums" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtPct(uw(r)?.rent_growth_fwd_pct)}</span> },
      { key: 'uw_vac', header: 'Vacancy Rate %', width: 110, align: 'right', sortable: false, editable: false, render: (r) => <span className="tabular-nums" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtPct(uw(r)?.vacancy_rate_pct)}</span> },
      { key: 'uw_mppu', header: 'Market Price/Unit', width: 120, align: 'right', sortable: false, editable: false, render: (r) => <span className="tabular-nums" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtCurrency(uw(r)?.market_price_per_unit)}</span> },
      { key: 'uw_delta', header: 'Delta %', width: 90, align: 'right', sortable: false, editable: false, render: (r) => <span className="tabular-nums" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtPct(uw(r)?.delta_pct)}</span> },
      { key: 'uw_caprate', header: 'Cap Rate', width: 90, align: 'right', sortable: false, editable: false, render: (r) => <span className="tabular-nums" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtPct(uw(r)?.cap_rate)}</span> },
      { key: 'uw_underwritable', header: 'Underwritable?', width: 110, sortable: false, editable: false, render: (r) => {
        const s = uw(r)?.underwritability_status
        if (!s) return <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
        return <Badge variant={s === 'go' ? 'success' : s === 'no_go' ? 'neutral' : 'warning'} size="sm">{s === 'go' ? 'Yes' : s === 'no_go' ? 'No' : 'Maybe'}</Badge>
      }},
    ]
    for (const c of evalCols) cols.push(c)

    // Underwriting Summary (Underwriting tab fields)
    const summaryCols: ColumnDef<Deal>[] = [
      { key: 'uws_pur', header: 'Purchase Price', width: 120, align: 'right', sortable: false, editable: false, render: (r) => <span className="tabular-nums" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtCurrency(uw(r)?.purchase_price)}</span> },
      { key: 'uws_ppu2', header: 'Purchase Price/Unit', width: 120, align: 'right', sortable: false, editable: false, render: (r) => <span className="tabular-nums" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtCurrency(uw(r)?.purchase_price_per_unit)}</span> },
      { key: 'uws_capex', header: 'CAPEX', width: 90, align: 'right', sortable: false, editable: false, render: (r) => <span className="tabular-nums" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtCurrency(uw(r)?.capex)}</span> },
      { key: 'uws_occ', header: 'Occupancy %', width: 100, align: 'right', sortable: false, editable: false, render: (r) => <span className="tabular-nums" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtPct(uw(r)?.occupancy_pct)}</span> },
      { key: 'uws_irr', header: 'IRR', width: 70, align: 'right', sortable: false, editable: false, render: (r) => <span className="tabular-nums" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtPct(uw(r)?.irr_pct)}</span> },
      { key: 'uws_em', header: 'EM', width: 70, align: 'right', sortable: false, editable: false, render: (r) => <span className="tabular-nums" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-jetbrains-mono)' }}>{uw(r)?.equity_multiple != null ? uw(r)!.equity_multiple!.toFixed(2) : '—'}</span> },
      { key: 'uws_coc', header: 'CoC', width: 70, align: 'right', sortable: false, editable: false, render: (r) => <span className="tabular-nums" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtPct(uw(r)?.cash_on_cash_pct)}</span> },
      { key: 'uws_profit', header: 'Profit', width: 90, align: 'right', sortable: false, editable: false, render: (r) => <span className="tabular-nums" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtCurrency(uw(r)?.profit)}</span> },
      { key: 'uws_loi_rec', header: 'LOI Recommendation', width: 130, sortable: false, editable: false, render: (r) => <span style={{ color: 'var(--color-text-secondary)' }}>{fmtBool(uw(r)?.loi_recommendation)}</span> },
    ]
    for (const c of summaryCols) cols.push(c)

    // LOI Related
    const loiCols: ColumnDef<Deal>[] = [
      { key: 'loi_email', header: 'Email for LOI', minWidth: 140, sortable: false, editable: false, render: (r) => <span style={{ color: 'var(--color-text-secondary)' }}>{loi(r)?.loi_email || '—'}</span> },
      { key: 'loi_lasent', header: 'Last Email for LOI Sent On', width: 150, sortable: false, editable: false, render: (r) => (
        <span style={{ color: 'var(--color-text-tertiary)', fontSize: 12, fontFamily: 'var(--font-jetbrains-mono)' }}>
          {loi(r)?.last_loi_email_sent_at ? formatDate(loi(r)!.last_loi_email_sent_at!) : '—'}
        </span>
      )},
      { key: 'loi_status', header: 'LOI Status', width: 110, sortable: false, editable: false, render: (r) => {
        const status = loi(r)?.outcome
        if (!status) return <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
        return <Badge variant={status === 'deal_reached' ? 'success' : status === 'fallen_through' ? 'neutral' : 'warning'} size="sm">{status.replace(/_/g, ' ')}</Badge>
      }},
    ]
    for (const c of loiCols) cols.push(c)


    // Filter out excluded columns (e.g. 'portfolio' in portfolio views)
    if (excludeSet.size > 0) {
      return cols.filter(c => !excludeSet.has(c.key))
    }

    return cols
  }, [fieldDefs, getFieldValue, portfolios, excludeColumns])

  const fixedSystemKeys = new Set([
    'stage', 'portfolio', 'created_at', 'last_email_sent_on', 'response_type', 'campaign', 'score', 'outreach_emails',
  ])
  const fieldDefCount = fieldDefs?.filter(fd => fd.show_in_grid && !fixedSystemKeys.has(fd.key)).length ?? 0
  const stageIdx = fieldDefCount + 1
  const portfolioIdx = fieldDefCount + 2
  const responseTypeIdx = fieldDefCount + 5

  const editComponents = useMemo(() => {
    const map: Record<number, (props: { value: string; rowIndex: number; onChange: (val: string) => void; onCommit: (value?: string) => void; onDiscard: () => void; cellEl?: HTMLElement | null }) => React.ReactNode> = {}

    map[stageIdx] = ({ value, onChange, onCommit, onDiscard }) => (
      <InlineDropdownEditor
        value={value}
        options={DEAL_STAGES.map(s => ({ value: s, label: s.replace(/_/g, ' ') }))}
        onChange={onChange}
        onCommit={onCommit}
        onDiscard={onDiscard}
      />
    )

    if (portfolios?.length) {
      map[portfolioIdx] = ({ value, onChange, onCommit, onDiscard }) => (
        <InlineDropdownEditor
          value={value}
          options={portfolios.map(p => ({ value: p.id, label: p.name }))}
          onChange={onChange}
          onCommit={onCommit}
          onDiscard={onDiscard}
          placeholder="Select portfolio..."
        />
      )
    }

    map[responseTypeIdx] = ({ value, onChange, onCommit, onDiscard }) => (
      <InlineDropdownEditor
        value={value}
        options={RESPONSE_TYPES.map(rt => ({ value: rt, label: rt }))}
        onChange={onChange}
        onCommit={onCommit}
        onDiscard={onDiscard}
      />
    )

    return map
  }, [stageIdx, portfolioIdx, responseTypeIdx, portfolios])

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
      editComponents={editComponents}
    />
  )
}
