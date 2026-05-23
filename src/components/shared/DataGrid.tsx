'use client'

import { useRef, useState, useCallback, useMemo, useEffect, memo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowUpDown, ArrowUp, ArrowDown, Check, Minus, MoreHorizontal, ChevronLeft, ChevronRight, Plus, Trash2, X, Search, SlidersHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { useGridInteraction } from '@/lib/hooks/useGridInteraction'
import { useColumnWidths } from '@/lib/hooks/useColumnWidths'
import { useColumnOrder } from '@/lib/hooks/useColumnOrder'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

import type { CellAddress, CellRange } from '@/lib/types/grid'
import { isInAnyRange, cellAddressEqual, rangeNormalize } from '@/lib/types/grid'

export interface ColumnDef<T> {
  key: string
  header: string
  width?: number
  minWidth?: number
  maxWidth?: number
  align?: 'left' | 'right' | 'center'
  sortable?: boolean
  /** Custom header content. When provided, replaces the plain-text header label. */
  headerRender?: (col: ColumnDef<T>) => React.ReactNode
  render?: (row: T, index: number) => React.ReactNode
  accessor?: (row: T, index?: number) => string | number | null | undefined
  editable?: boolean
}

interface DataGridProps<T> {
  columns: ColumnDef<T>[]
  data: T[]
  rowKey: (row: T, index: number) => string
  onRowClick?: (row: T, index: number) => void
  loading?: boolean
  loadingRows?: number
  emptyMessage?: string
  emptyAction?: { label: string; onClick: () => void }
  rowHeight?: number
  maxHeight?: number | string
  className?: string
  editableColumns?: Set<number>
  onCellEdit?: (rowIndex: number, colIndex: number, value: string) => void
  editComponents?: Record<number, (props: { value: string; rowIndex: number; onChange: (val: string) => void; onCommit: () => void; onDiscard: () => void; cellEl?: HTMLElement | null }) => React.ReactNode>
  selectedRowIds?: Set<string>
  onSelectionChange?: (ids: Set<string>) => void
  fillHeight?: boolean
  bulkActions?: (selectedCount: number) => React.ReactNode
  /** When true, the header checkbox shows "all rows across pages" selected state. */
  allRowsSelected?: boolean
  /** Fires when user clicks header checkbox while all visible rows are already selected. */
  onSelectAll?: () => void
  /** When true, data is pre-sorted by the server. Client-side sorting is skipped. */
  serverSide?: boolean
  /** Controlled sort key (only meaningful with serverSide). */
  serverSortKey?: string | null
  /** Controlled sort direction (only meaningful with serverSide). */
  serverSortDir?: 'asc' | 'desc'
  /** Fires when user clicks a column header to sort. Parent should refetch. */
  onSortChange?: (key: string, dir: 'asc' | 'desc') => void
  /** Selection toolbar — quick icon-only action buttons */
  selectionActions?: { id: string; icon: React.ReactNode; label: string; onClick: (ids: string[]) => void }[]
  /** Selection toolbar — 3-dot dropdown menu actions */
  selectionMenuActions?: { id: string; label: string; onClick: (ids: string[]) => void }[]
  /** Built-in pagination. Omit to hide (pagination managed externally). */
  totalRows?: number
  page?: number
  pageSize?: number
  onPageChange?: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  pageSizes?: number[]
  /** Top toolbar — actions, search, filters. Omit to hide. */
  topToolbar?: {
    recordLabel?: string
    onAdd?: () => void
    onDelete?: (ids: string[]) => void
    actions?: { id: string; icon: React.ReactNode; label: string; onClick: () => void }[]
    searchValue?: string
    onSearchChange?: (value: string) => void
    searchPlaceholder?: string
    menuActions?: { id: string; label: string; onClick: () => void }[]
  }
  /** Column filters shown in top toolbar. Each renders as a dropdown. */
  filters?: {
    id: string
    label: string
    options: { value: string; label: string }[]
    value: string | null
    onChange: (value: string | null) => void
  }[]
  /** External search/filter chip count. Render badge on filter button. */
  activeFilterCount?: number
  onClearFilters?: () => void
  /** When provided, enables drag-and-drop column reordering. Value is a localStorage key suffix for persistence. */
  columnOrderStorageKey?: string
}

const CHECKBOX_COL_W = 40

const S = {
  headerH: 36,
  rowH: 40,
  footerH: 32,
  checkboxW: CHECKBOX_COL_W,
  rowNumW: 44,
  headerBg: 'var(--color-surface-3)',
  headerText: 'var(--color-text-secondary)',
  headerBorder: 'var(--color-surface-2)',
  headerTextActive: 'var(--color-text-primary)',
  rowEvenBg: 'var(--color-surface-0)',
  rowOddBg: 'var(--color-surface-1)',
  rowBorder: 'var(--color-surface-2)',
  rowHoverBg: 'var(--color-accent-bg)',
  cellText: 'var(--color-text-secondary)',
  cellTextPrimary: 'var(--color-text-primary)',
  rowNumText: 'var(--color-text-tertiary)',
  footerBg: 'var(--color-surface-1)',
  footerBorder: 'var(--color-surface-2)',
  accent: 'var(--accent)',
  accentBg: 'var(--color-accent-bg)',
  containerBorder: 'var(--color-surface-3)',
  skelShimmer1: 'var(--color-surface-1)',
  skelShimmer2: 'var(--color-surface-2)',
} as const

interface RowRendererProps<T> {
  row: T
  rowIndex: number
  columns: ColumnDef<T>[]
  computedWidths: Record<string, number>
  isEven: boolean
  onRowClick?: (row: T, index: number) => void
  interactionState: ReturnType<typeof useGridInteraction>['state']
  interactionHandlers: Pick<ReturnType<typeof useGridInteraction>, 'onCellMouseDown' | 'onCellMouseEnter' | 'onCellMouseUp' | 'onCellDoubleClick' | 'onCellClick'>
  editingValue: string
  onDraftChange: (val: string) => void
  commitEdit: () => void
  onRowKeyDown: (e: React.KeyboardEvent) => void
  isSelected: boolean
  onCheckboxToggle: (rowIndex: number) => void
  flashingCell: CellAddress | null
  validationFlashCell: CellAddress | null
  saveSuccessCell: CellAddress | null
  editComponents?: Record<number, (props: { value: string; rowIndex: number; onChange: (val: string) => void; onCommit: () => void; onDiscard: () => void; cellEl?: HTMLElement | null }) => React.ReactNode>
}

const RowRenderer = memo(function RowRendererInner<T>({
  row, rowIndex, columns, computedWidths, isEven, onRowClick,
  interactionState, interactionHandlers, editingValue, onDraftChange, commitEdit, onRowKeyDown,
  isSelected, onCheckboxToggle, flashingCell, validationFlashCell, saveSuccessCell, editComponents,
}: RowRendererProps<T>) {
  const { onCellClick } = interactionHandlers
  const rowBg = isEven ? S.rowEvenBg : S.rowOddBg
  const focusCell = interactionState.focusCell
  const selectionRanges = interactionState.selectionRanges
  const editingCell = interactionState.editingCell
  const selectedBg = 'var(--color-accent-bg)'
  const editingColName = editingCell ? (columns[editingCell.colIndex]?.header ?? '') : ''
  const editingRowNum = editingCell ? editingCell.rowIndex + 1 : 0

  return (
    <div
      className="flex absolute top-0 left-0 border-b transition-colors"
      style={{
        height: S.rowH, width: '100%',
        borderColor: S.rowBorder, background: isSelected ? selectedBg : rowBg,
        cursor: 'default',
        borderLeft: isSelected ? `2px solid ${S.accent}` : undefined,
        paddingLeft: isSelected ? 0 : undefined,
      }}
      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = S.rowHoverBg }}
      onMouseLeave={(e) => { e.currentTarget.style.background = isSelected ? selectedBg : rowBg }}
    >
      {/* Checkbox column */}
      <div
        className="flex-shrink-0 sticky left-0 z-20 flex items-center justify-center border-r select-none"
        style={{
          width: S.checkboxW, height: S.rowH,
          borderColor: S.rowBorder, background: rowBg,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <label className="flex items-center justify-center cursor-pointer" style={{ width: 18, height: 18 }} onClick={(e) => { e.preventDefault(); onCheckboxToggle(rowIndex) }}>
          {/* selection toggled via label onClick — avoids controlled-checkbox timing quirks */}
          <div
            className="flex items-center justify-center rounded transition-colors"
            style={{
              width: 16, height: 16,
              border: `1.5px solid ${isSelected ? S.accent : 'var(--color-surface-3)'}`,
              background: isSelected ? S.accent : 'transparent',
            }}
          >
            {isSelected && <Check className="h-3 w-3" style={{ color: 'var(--color-text-inverse)' }} strokeWidth={3} />}
          </div>
        </label>
      </div>

      {/* Row number — click navigates to deal detail */}
      <div
        className="flex-shrink-0 sticky left-[40px] z-10 flex items-center justify-end px-2 text-[11px] border-r select-none tabular-nums"
        style={{ width: S.rowNumW, height: S.rowH, borderColor: S.rowBorder, background: rowBg, color: S.rowNumText, cursor: onRowClick ? 'pointer' : 'default' }}
        onClick={(e) => { e.stopPropagation(); onRowClick?.(row as Parameters<typeof onRowClick>[0], rowIndex) }}
      >
        {rowIndex + 1}
      </div>

      {columns.map((col, colIndex) => {
        const w = computedWidths[col.key] ?? 100
        const addr: CellAddress = { rowIndex, colIndex }
        const isFocused = focusCell !== null && cellAddressEqual(addr, focusCell)
        const isCellSelected = selectionRanges.length > 0 && isInAnyRange(addr, selectionRanges)
        const isEditingCell = editingCell !== null && cellAddressEqual(addr, editingCell)
        const isActionsCol = col.key === 'actions'

        const val = col.accessor
          ? col.accessor(row, rowIndex)
          : ((row as Record<string, unknown>)[col.key] as string | number | null | undefined)
        const displayVal = val != null && val !== '' ? String(val) : '—'

        let cellBg = 'transparent'
        if (isFocused && !isCellSelected) {
          cellBg = S.accentBg
        } else if (isCellSelected) {
          cellBg = `color-mix(in srgb, ${S.accent} 15%, var(--color-surface-0))`
        }

        return (
          <div
            key={col.key}
            data-col-key={col.key}
            role="gridcell"
            id={`grid-cell-r${rowIndex}-c${colIndex}`}
            className={`flex-shrink-0 flex items-center px-3 border-r text-[13px] relative ${isActionsCol ? 'sticky right-0 z-10' : ''}`}
            style={{
              width: w, height: S.rowH, borderColor: S.rowBorder, background: cellBg,
              justifyContent: col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start',
            }}
            onMouseDown={(e) => interactionHandlers.onCellMouseDown(addr, e)}
            onMouseEnter={() => interactionHandlers.onCellMouseEnter(addr)}
            onMouseUp={interactionHandlers.onCellMouseUp}
            onDoubleClick={() => interactionHandlers.onCellDoubleClick(addr)}
            onClick={(e) => { if (onRowClick) e.stopPropagation(); onCellClick(addr) }}
          >
            {isEditingCell ? (
              editComponents?.[colIndex] ? (
                editComponents[colIndex]!({
                  value: editingValue,
                  rowIndex,
                  onChange: onDraftChange,
                  onCommit: commitEdit,
                  onDiscard: () => {},
                  cellEl: undefined,
                })
              ) : (
                <input
                  autoFocus
                  aria-label={`${editingColName}, row ${editingRowNum}, edit`}
                  className="absolute inset-0 w-full h-full px-3 text-[13px] outline-none"
                  style={{
                    background: 'var(--color-surface-0)',
                    border: `2px solid ${S.accent}`,
                    boxShadow: `0 0 0 4px color-mix(in srgb, ${S.accent} 20%, transparent)`,
                    fontFamily: 'var(--font-dm-sans)',
                    color: 'var(--color-text-primary)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                  value={editingValue}
                  onChange={(e) => onDraftChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === 'Tab' || e.key === 'Escape') {
                      onRowKeyDown(e)
                    }
                  }}
                  onBlur={() => commitEdit()}
                />
              )
            ) : col.render ? (
              col.render(row, rowIndex)
            ) : (
              <span className="truncate" style={{ color: S.cellText }}>{displayVal}</span>
            )}
            {isFocused && !isEditingCell && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ border: `2px solid ${S.accent}` }}
              />
            )}
            {flashingCell && cellAddressEqual(addr, flashingCell) && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ border: `2px solid var(--color-surface-3)`, transition: 'opacity 600ms ease' }}
              />
            )}
            {validationFlashCell && cellAddressEqual(addr, validationFlashCell) && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ border: `2px solid var(--color-error, #ef4444)`, transition: 'opacity 600ms ease' }}
              />
            )}
            {saveSuccessCell && cellAddressEqual(addr, saveSuccessCell) && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ border: `2px solid var(--color-success, #22c55e)`, transition: 'opacity 800ms ease-out' }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}, (prevProps, nextProps) => {
  // Spec §10.2: only re-render row if data, selection, focus, or editing state changed
  if (prevProps.row !== nextProps.row) return false
  if (prevProps.rowIndex !== nextProps.rowIndex) return false
  if (prevProps.computedWidths !== nextProps.computedWidths) return false
  if (prevProps.isEven !== nextProps.isEven) return false
  if (prevProps.isSelected !== nextProps.isSelected) return false
  if (prevProps.editingValue !== nextProps.editingValue) return false
  if (prevProps.flashingCell !== nextProps.flashingCell) return false
  if (prevProps.validationFlashCell !== nextProps.validationFlashCell) return false
  if (prevProps.saveSuccessCell !== nextProps.saveSuccessCell) return false
  const pf = prevProps.interactionState.focusCell
  const nf = nextProps.interactionState.focusCell
  if (pf !== nf && (pf?.rowIndex !== nf?.rowIndex)) return false
  const pe = prevProps.interactionState.editingCell
  const ne = nextProps.interactionState.editingCell
  if (pe !== ne && (pe?.rowIndex !== ne?.rowIndex)) return false
  const pr = prevProps.interactionState.selectionRanges
  const nr = nextProps.interactionState.selectionRanges
  if (pr !== nr && pr.length !== nr.length) return false
  if (pr !== nr) {
    for (let i = 0; i < pr.length; i++) {
      if (pr[i] !== nr[i]) return false
    }
  }
  return true
})

/** Page-size selector with "Custom…" option. */
function PageSizeSelector({
  pageSize, pageSizes, onPageSizeChange,
}: {
  pageSize: number
  pageSizes: number[]
  onPageSizeChange?: (size: number) => void
}) {
  const [customOpen, setCustomOpen] = useState(false)
  const [customValue, setCustomValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const isCustom = !pageSizes.includes(pageSize)

  const options = isCustom
    ? [...pageSizes, pageSize].sort((a, b) => a - b)
    : pageSizes

  useEffect(() => {
    if (customOpen) {
      setCustomValue(String(pageSize))
      setTimeout(() => inputRef.current?.select(), 0)
    }
  }, [customOpen, pageSize])

  const applyCustom = () => {
    const n = parseInt(customValue, 10)
    if (n >= 1 && n <= 5000) {
      onPageSizeChange?.(n)
    }
    setCustomOpen(false)
  }

  const largeThreshold = 500
  const isLarge = parseInt(customValue, 10) > largeThreshold

  return (
    <div className="flex items-center gap-1.5 text-[12px] relative" style={{ color: 'var(--color-text-tertiary)' }}>
      <span>Rows</span>
      {customOpen ? (
        <div className="relative">
          <input
            ref={inputRef}
            type="number"
            min={1}
            max={5000}
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') applyCustom(); if (e.key === 'Escape') setCustomOpen(false) }}
            onBlur={applyCustom}
            className="w-[64px] h-[28px] px-2 rounded-md bg-transparent border-none outline-none text-[12px] tabular-nums"
            style={{
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-jetbrains-mono)',
              background: 'var(--color-surface-0)',
              border: `1.5px solid ${isLarge ? 'var(--color-warning, #f59e0b)' : 'var(--accent)'}`,
              boxShadow: isLarge ? '0 0 0 3px var(--color-warning-bg, #fef3c7)' : '0 0 0 3px var(--color-accent-bg)',
            }}
          />
          {isLarge && (
            <div
              className="absolute bottom-full left-0 mb-1 px-2 py-0.5 rounded text-[10px] whitespace-nowrap z-50"
              style={{
                background: 'var(--color-warning, #f59e0b)',
                color: 'var(--color-text-primary)',
                fontWeight: 500,
              }}
            >
              Rendering may slow down
              <div
                className="absolute top-full left-3 -mt-px"
                style={{
                  width: 0, height: 0,
                  borderLeft: '4px solid transparent',
                  borderRight: '4px solid transparent',
                  borderTop: `4px solid var(--color-warning, #f59e0b)`,
                }}
              />
            </div>
          )}
        </div>
      ) : (
        <Select
          value={String(pageSize)}
          onValueChange={(v) => {
            if (v === 'custom') { setCustomOpen(true); return }
            onPageSizeChange?.(Number(v))
          }}
        >
          <SelectTrigger className="h-[28px] w-[72px] text-[12px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((ps) => (
              <SelectItem key={ps} value={String(ps)}>{ps}</SelectItem>
            ))}
            <SelectItem value="custom">Custom…</SelectItem>
          </SelectContent>
        </Select>
      )}
    </div>
  )
}

/** Unified bottom toolbar — row count, selection actions, pagination. */
function Toolbar({
  sortedDataLength,
  sortKey,
  sortColumnHeader,
  defaultSortKey,
  selectedCount,
  selectedIds,
  selectionActions,
  selectionMenuActions,
  bulkActions,
  onClearSelection,
  pagination,
}: {
  sortedDataLength: number
  sortKey: string | null
  sortColumnHeader: string | undefined
  defaultSortKey?: string
  selectedCount: number
  selectedIds: string[]
  selectionActions?: { id: string; icon: React.ReactNode; label: string; onClick: (ids: string[]) => void }[]
  selectionMenuActions?: { id: string; label: string; onClick: (ids: string[]) => void }[]
  bulkActions?: (selectedCount: number) => React.ReactNode
  onClearSelection: () => void
  pagination?: {
    totalRows: number
    page: number
    pageSize: number
    onPageChange: (page: number) => void
    onPageSizeChange?: (pageSize: number) => void
    pageSizes: number[]
  }
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const tb = {
    h: 40,
    bg: 'var(--color-surface-1)',
    border: 'var(--color-surface-2)',
    text: 'var(--color-text-tertiary)',
    textPrimary: 'var(--color-text-primary)',
    accent: 'var(--accent)',
    accentBg: 'var(--color-accent-bg)',
  } as const

  const btnBase = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    height: 28, width: 28, borderRadius: 'var(--radius-sm)',
    border: 'none', cursor: 'pointer', flexShrink: 0,
    background: 'transparent', color: tb.text,
    transition: 'background 120ms, color 120ms',
  } as const

  return (
    <div
      className="flex items-center border-t select-none gap-2"
      style={{ height: tb.h, background: tb.bg, borderColor: tb.border, padding: '0 8px 0 12px' }}
    >
      {/* Left — row count or selection info */}
      <div className="flex items-center gap-2 flex-shrink-0" style={{ minWidth: 0 }}>
        {selectedCount > 0 ? (
          <>
            <button
              onClick={onClearSelection}
              style={btnBase}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-2)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              title="Clear selection"
            >
              <Check className="h-3.5 w-3.5" style={{ color: tb.accent }} strokeWidth={3} />
            </button>
            <span className="text-[12px] font-medium whitespace-nowrap" style={{ color: tb.textPrimary }}>
              {selectedCount.toLocaleString()} selected
            </span>
          </>
        ) : (
          <span className="text-[12px] whitespace-nowrap" style={{ color: tb.text, fontFamily: 'var(--font-jetbrains-mono)' }}>
            {sortedDataLength.toLocaleString()} row{sortedDataLength !== 1 ? 's' : ''}
            {sortedDataLength > 0 && sortKey && sortKey !== defaultSortKey && (
              <span style={{ color: 'var(--color-text-secondary)' }}>
                {' · sorted by '}{sortColumnHeader ?? sortKey}
              </span>
            )}
          </span>
        )}
      </div>

      {/* Center — quick action buttons + 3-dot menu (only when selection active) */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-0.5 flex-1 justify-center">
          {selectionActions?.map((a) => (
            <button
              key={a.id}
              style={btnBase}
              onClick={() => a.onClick(selectedIds)}
              title={a.label}
              onMouseEnter={(e) => { e.currentTarget.style.background = tb.accentBg; e.currentTarget.style.color = tb.accent }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = tb.text }}
            >
              {a.icon}
            </button>
          ))}
          {bulkActions?.(selectedCount)}
          {selectionMenuActions && selectionMenuActions.length > 0 && (
            <div ref={menuRef} className="relative">
              <button
                style={btnBase}
                onClick={() => setMenuOpen(!menuOpen)}
                title="More actions"
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-2)' }}
                onMouseLeave={(e) => { if (!menuOpen) e.currentTarget.style.background = 'transparent' }}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {menuOpen && (
                <div
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 rounded-lg shadow-lg py-1 z-50 min-w-[140px]"
                  style={{ background: 'var(--color-surface-0)', border: '1px solid var(--color-surface-3)' }}
                >
                  {selectionMenuActions.map((m) => (
                    <button
                      key={m.id}
                      className="flex items-center w-full px-3 py-1.5 text-[13px] transition-colors whitespace-nowrap"
                      style={{ color: 'var(--color-text-secondary)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-1)'; e.currentTarget.style.color = 'var(--color-text-primary)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-secondary)' }}
                      onClick={() => { m.onClick(selectedIds); setMenuOpen(false) }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Right — pagination */}
      {pagination && (
        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
          <PageSizeSelector
            pageSize={pagination.pageSize}
            pageSizes={pagination.pageSizes}
            onPageSizeChange={(v) => pagination.onPageSizeChange?.(v)}
          />
          <PaginationPages
            page={pagination.page}
            pageSize={pagination.pageSize}
            total={pagination.totalRows}
            onPageChange={pagination.onPageChange}
          />
        </div>
      )}
    </div>
  )
}

/** Compact page-number controls with a central page-input. */
function PaginationPages({
  page, pageSize, total, onPageChange,
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (p: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  const pages = useMemo(() => {
    const p: (number | '...')[] = []
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
        p.push(i)
      } else if (p[p.length - 1] !== '...') {
        p.push('...')
      }
    }
    return p
  }, [page, totalPages])

  const btnStyle = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    height: 26, minWidth: 26, padding: '0 4px', borderRadius: 'var(--radius-sm)',
    border: 'none', cursor: 'pointer', fontSize: 12, flexShrink: 0,
    background: 'transparent', color: 'var(--color-text-secondary)',
    fontFamily: 'var(--font-jetbrains-mono)',
    transition: 'background 120ms',
  } as const

  return (
    <div className="flex items-center gap-0.5">
      <span className="text-[11px] mr-1" style={{ color: 'var(--color-text-tertiary)' }}>
        {start.toLocaleString()}–{end.toLocaleString()} of {total.toLocaleString()}
      </span>
      <button
        style={btnStyle}
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        onMouseEnter={(e) => { if (page > 1) e.currentTarget.style.background = 'var(--color-surface-2)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`dots-${i}`} className="px-0.5 text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>…</span>
        ) : p === page ? (
          <PageInput
            key={`page-input`}
            page={page}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        ) : (
          <button
            key={p}
            style={btnStyle}
            onClick={() => onPageChange(p)}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-2)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            {p}
          </button>
        )
      )}
      <button
        style={btnStyle}
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        onMouseEnter={(e) => { if (page < totalPages) e.currentTarget.style.background = 'var(--color-surface-2)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

/** Controlled page-number input — keystroke-filtered via onKeyDown, clamped on blur. */
function PageInput({
  page, totalPages, onPageChange,
}: {
  page: number
  totalPages: number
  onPageChange: (p: number) => void
}) {
  const [value, setValue] = useState(String(page))
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync display when page changes externally (prev/next clicks)
  useEffect(() => {
    if (!focused) setValue(String(page))
  }, [page, focused])

  const commit = useCallback((v: string) => {
    const n = parseInt(v, 10)
    if (!isNaN(n) && n >= 1 && n <= totalPages && n !== page) {
      onPageChange(n)
    } else {
      setValue(String(page))
    }
  }, [page, totalPages, onPageChange])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Tab']

    if (e.key === 'Enter') {
      e.preventDefault()
      commit(value)
      inputRef.current?.blur()
      return
    }
    if (e.key === 'Escape') {
      setValue(String(page))
      inputRef.current?.blur()
      return
    }

    // Reject non-numeric keys (allow navigation + delete keys)
    if (!/^\d$/.test(e.key) && !allowed.includes(e.key)) {
      e.preventDefault()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Safety net: strip any non-digits that slipped through (paste, IME, etc.)
    const cleaned = e.target.value.replace(/\D/g, '')
    if (cleaned.length <= 6) setValue(cleaned)
  }

  const handleBlur = () => {
    setFocused(false)
    commit(value)
  }

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onFocus={() => setFocused(true)}
      onBlur={handleBlur}
      className="text-center outline-none rounded-sm"
      title={`Page ${page} of ${totalPages}`}
      style={{
        height: 26, width: 36,
        padding: 0,
        background: 'var(--color-surface-0)',
        border: '1px solid var(--color-surface-3)',
        color: 'var(--color-text-primary)',
        fontSize: 12, fontWeight: 500,
        fontFamily: 'var(--font-jetbrains-mono)',
        borderRadius: 'var(--radius-sm)',
      }}
    />
  )
}

/** Top toolbar — search on left, actions + filters + 3-dot menu on right. */
function TopToolbar({
  recordLabel = 'record',
  selectedCount,
  selectedIds,
  onAdd,
  onDelete,
  onClearSelection,
  onClearSort,
  sortKey,
  sortColumnHeader,
  defaultSortKey,
  actions,
  menuActions,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  filters,
  activeFilterCount,
  onClearFilters,
}: {
  recordLabel?: string
  selectedCount: number
  selectedIds: string[]
  onAdd?: () => void
  onDelete?: (ids: string[]) => void
  onClearSelection: () => void
  onClearSort?: () => void
  sortKey?: string | null
  sortColumnHeader?: string
  defaultSortKey?: string
  actions?: { id: string; icon: React.ReactNode; label: string; onClick: () => void }[]
  menuActions?: { id: string; label: string; onClick: () => void }[]
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  filters?: { id: string; label: string; options: { value: string; label: string }[]; value: string | null; onChange: (value: string | null) => void }[]
  activeFilterCount?: number
  onClearFilters?: () => void
}) {
  const [searchFocused, setSearchFocused] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const st = {
    h: 44,
    bg: 'var(--color-surface-0)',
    border: 'var(--color-surface-2)',
    textMuted: 'var(--color-text-tertiary)',
    text: 'var(--color-text-secondary)',
    accent: 'var(--accent)',
    accentBg: 'var(--color-accent-bg)',
    danger: 'var(--color-danger)',
    dangerBg: 'var(--color-danger-bg, #fef2f2)',
  } as const

  const iconButton = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    height: 30, width: 30, borderRadius: 'var(--radius-sm)',
    border: 'none', cursor: 'pointer', flexShrink: 0,
    fontSize: 12, fontWeight: 500,
    background: 'transparent', color: st.text,
    transition: 'background 120ms, color 120ms',
  } as const

  const hoverBg = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.background = 'var(--color-surface-2)' }
  const resetBg = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.background = 'transparent' }

  return (
    <div
      className="flex items-center border-b select-none gap-2"
      style={{ height: st.h, background: st.bg, borderColor: st.border, padding: '0 6px' }}
    >
      {/* ── Left: Search bar (prominent, always outlined) ── */}
      {onSearchChange != null ? (
        <div
          className="flex items-center gap-1.5 px-3 rounded-md transition-all flex-shrink-0"
          style={{
            height: 32, width: '100%', maxWidth: 400,
            background: searchFocused ? 'var(--color-surface-1)' : 'var(--color-surface-0)',
            border: searchFocused
              ? `1.5px solid ${st.accent}`
              : `1.5px solid var(--color-surface-3)`,
            boxShadow: searchFocused ? `0 0 0 3px ${st.accentBg}` : 'none',
          }}
        >
          <Search className="h-3.5 w-3.5 flex-shrink-0" style={{ color: searchFocused ? st.accent : st.textMuted }} />
          <input
            ref={inputRef}
            type="text"
            value={searchValue ?? ''}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder={searchPlaceholder ?? `Search ${recordLabel}s...`}
            className="flex-1 bg-transparent border-none outline-none text-[13px] min-w-0"
            style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans)' }}
          />
          {searchValue && (
            <button
              onClick={() => { onSearchChange(''); inputRef.current?.focus() }}
              style={{ ...iconButton, width: 20, height: 20, borderRadius: '50%' }}
              onMouseEnter={hoverBg}
              onMouseLeave={resetBg}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      ) : (
        <div />
      )}

      {/* Dynamic spacer — pushes actions to far right */}
      <div className="flex-1" />

      {/* ── Right: Action buttons + 3-dot menu + filters ── */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {/* Clear sort — only when user changed from default */}
        {sortKey && sortKey !== defaultSortKey && onClearSort && (
          <button
            style={{ ...iconButton, width: 'auto', padding: '0 8px', gap: 3 }}
            onClick={onClearSort}
            title={`Clear sort (${sortColumnHeader ?? sortKey})`}
            onMouseEnter={hoverBg}
            onMouseLeave={resetBg}
          >
            <ArrowUpDown className="h-3 w-3" />
            <span className="text-[11px]">Clear sort</span>
          </button>
        )}

        {/* Clear selection */}
        {selectedCount > 0 && (
          <button
            style={{ ...iconButton, width: 'auto', padding: '0 8px', gap: 3 }}
            onClick={onClearSelection}
            onMouseEnter={hoverBg}
            onMouseLeave={resetBg}
          >
            <X className="h-3 w-3" />
            <span className="text-[11px]">Clear selection</span>
          </button>
        )}

        {/* Delete */}
        {onDelete && (
          <button
            style={{
              ...iconButton,
              width: 'auto', padding: '0 8px', gap: 3,
              background: selectedCount > 0 ? st.dangerBg : 'transparent',
              color: selectedCount > 0 ? st.danger : st.text,
              opacity: selectedCount > 0 ? 1 : 0.3,
              pointerEvents: selectedCount > 0 ? 'auto' : 'none',
            }}
            onClick={() => onDelete(selectedIds)}
            title={selectedCount > 0 ? `Delete ${selectedCount} ${recordLabel}${selectedCount !== 1 ? 's' : ''}` : 'Select rows to delete'}
            onMouseEnter={(e) => {
              if (selectedCount > 0) { e.currentTarget.style.background = st.danger; e.currentTarget.style.color = 'var(--color-text-inverse)' }
            }}
            onMouseLeave={(e) => { e.currentTarget.style.background = st.dangerBg; e.currentTarget.style.color = st.danger }}
          >
            <Trash2 className="h-3 w-3" />
            <span className="text-[11px]">Delete {recordLabel}</span>
          </button>
        )}

        {/* Add */}
        {onAdd && (
          <button
            style={{ ...iconButton, width: 'auto', padding: '0 10px', gap: 5, background: st.accent, color: 'var(--color-text-inverse)' }}
            onClick={onAdd}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9' }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New {recordLabel}</span>
          </button>
        )}

        {/* Custom icon actions */}
        {actions?.map((a) => (
          <button
            key={a.id}
            style={iconButton}
            onClick={a.onClick}
            title={a.label}
            onMouseEnter={hoverBg}
            onMouseLeave={resetBg}
          >
            {a.icon}
          </button>
        ))}

        {/* 3-dot menu — always visible, icon only */}
        <div ref={menuRef} className="relative">
          <button
            style={iconButton}
            onClick={() => setMenuOpen(!menuOpen)}
            title="More actions"
            onMouseEnter={hoverBg}
            onMouseLeave={(e) => { if (!menuOpen) resetBg(e) }}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div
              className="absolute top-full right-0 mt-1 rounded-lg shadow-lg py-1 z-50 min-w-[150px]"
              style={{ background: 'var(--color-surface-0)', border: '1px solid var(--color-surface-3)' }}
            >
              {(menuActions && menuActions.length > 0
                ? menuActions.map((m) => (
                    <button
                      key={m.id}
                      className="flex items-center w-full px-3 py-1.5 text-[13px] transition-colors whitespace-nowrap"
                      style={{ color: 'var(--color-text-secondary)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-1)'; e.currentTarget.style.color = 'var(--color-text-primary)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-secondary)' }}
                      onClick={() => { m.onClick(); setMenuOpen(false) }}
                    >
                      {m.label}
                    </button>
                  ))
                : [
                    { id: 'export', label: 'Export CSV' },
                    { id: 'archive', label: 'Archive all' },
                    { id: 'columns', label: 'Manage columns' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      className="flex items-center w-full px-3 py-1.5 text-[13px] transition-colors whitespace-nowrap"
                      style={{ color: 'var(--color-text-secondary)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-1)'; e.currentTarget.style.color = 'var(--color-text-primary)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-secondary)' }}
                      onClick={() => setMenuOpen(false)}
                    >
                      {m.label}
                    </button>
                  ))
              )}
            </div>
          )}
        </div>

        {/* Divider — before filters */}
        {filters?.length ? (
          <div className="w-px h-5 mx-1 flex-shrink-0" style={{ background: st.border }} />
        ) : null}

        {/* Filter dropdowns */}
        {filters?.map((f) => (
          <Select
            key={f.id}
            value={f.value ?? 'all'}
            onValueChange={(v) => f.onChange(v === 'all' ? null : v)}
          >
            <SelectTrigger
              className="h-[28px] text-[12px] gap-1"
              style={{
                minWidth: 70, maxWidth: 120,
                borderColor: f.value ? st.accent : 'var(--color-surface-3)',
                background: f.value ? st.accentBg : 'transparent',
                color: f.value ? st.accent : st.text,
              }}
            >
              <SlidersHorizontal className="h-3 w-3 flex-shrink-0" />
              <SelectValue placeholder={f.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All {f.label}</SelectItem>
              {f.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}

        {/* Clear all filters */}
        {onClearFilters && (activeFilterCount ?? 0) > 0 && (
          <button
            style={{ ...iconButton, width: 'auto', padding: '0 8px', gap: 3, color: st.textMuted }}
            onClick={onClearFilters}
            title="Clear all filters"
            onMouseEnter={(e) => { e.currentTarget.style.color = st.text }}
            onMouseLeave={(e) => { e.currentTarget.style.color = st.textMuted }}
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        )}
      </div>
    </div>
  )
}

export function DataGrid<T>({
  columns,
  data,
  rowKey,
  onRowClick,
  loading = false,
  loadingRows = 10,
  emptyMessage = 'No data found',
  emptyAction,
  rowHeight = S.rowH,
  maxHeight = 520,
  fillHeight = false,
  className,
  editableColumns,
  onCellEdit,
  editComponents,
  selectedRowIds: controlledSelectedRowIds,
  onSelectionChange,
  bulkActions,
  allRowsSelected = false,
  onSelectAll,
  serverSide = false,
  serverSortKey,
  serverSortDir = 'desc',
  onSortChange,
  selectionActions,
  selectionMenuActions,
  totalRows,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizes = [25, 50, 100, 250],
  topToolbar,
  filters,
  activeFilterCount,
  onClearFilters,
  columnOrderStorageKey,
}: DataGridProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [internalSortKey, setInternalSortKey] = useState<string | null>(null)
  const [internalSortDir, setInternalSortDir] = useState<'asc' | 'desc'>('asc')
  const sortKey = serverSide ? (serverSortKey ?? null) : internalSortKey
  const sortDir = serverSide ? serverSortDir : internalSortDir
  const { orderedColumns, onReorder } = useColumnOrder(columnOrderStorageKey, columns)
  const { widths: columnWidths, setWidth: setColumnWidth, autoFitColumn, autoFitSelected } = useColumnWidths()
  const [resizeIndicatorX, setResizeIndicatorX] = useState<number | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)
  const dragSourceKeyRef = useRef<string | null>(null)
  const resizeJustOccurredRef = useRef(false)
  const resizingRef = useRef<{
    key: string; startX: number; startWidth: number; totalStartWidth: number; lastClientX?: number; el: HTMLElement | null;
    multiCols?: { key: string; startWidth: number; ratio: number; el: HTMLElement | null }[] | null;
  } | null>(null)
  const resizeRafRef = useRef<number | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const [selectedColKeys, setSelectedColKeys] = useState<Set<string>>(new Set())
  const lastShiftClickColRef = useRef<string | null>(null)

  const isControlled = controlledSelectedRowIds !== undefined
  const [internalSelectedIds, setInternalSelectedIds] = useState<Set<string>>(new Set())
  const resolvedSelectedIds = isControlled ? controlledSelectedRowIds! : internalSelectedIds

  const sortedData = useMemo(() => {
    if (serverSide || !sortKey) return data
    const col = orderedColumns.find((c) => c.key === sortKey)
    if (!col) return data
    const getter = col.accessor ?? ((r: T) => (r as Record<string, unknown>)[col.key] as string | number | null | undefined)
    return [...data].sort((a, b) => {
      const va = getter(a, 0) ?? ''
      const vb = getter(b, 0) ?? ''
      const cmp = va < vb ? -1 : va > vb ? 1 : 0
      return sortDir === 'desc' ? -cmp : cmp
    })
  }, [serverSide, data, sortKey, sortDir, orderedColumns])

  // Refs hold latest values so toggleRowSelection stays stable across selection changes.
  // Without this, RowRenderer memo comparator skips re-render for unselected rows,
  // leaving them with a stale toggleRowSelection closure that captures old resolvedSelectedIds.
  const selRef = useRef(resolvedSelectedIds)
  selRef.current = resolvedSelectedIds
  const sortedRef = useRef(sortedData)
  sortedRef.current = sortedData
  const rowKeyRef = useRef(rowKey)
  rowKeyRef.current = rowKey
  const onSelChangeRef = useRef(onSelectionChange)
  onSelChangeRef.current = onSelectionChange

  const allSelected = sortedData.length > 0 && resolvedSelectedIds.size === sortedData.length
  const someSelected = resolvedSelectedIds.size > 0 && !allSelected

  const computedWidths = useMemo(() => {
    const w: Record<string, number> = {}
    const sample = sortedData.slice(0, 50)
    for (const col of orderedColumns) {
      if (columnWidths[col.key] !== undefined) { w[col.key] = columnWidths[col.key]!; continue }
      let maxChars = col.header.length
      const getter = col.accessor ?? ((r: T) => (r as Record<string, unknown>)[col.key] as string | number | null | undefined)
      for (const row of sample) {
        const val = getter(row, 0)
        const len = val != null ? String(val).length : 0
        if (len > maxChars) maxChars = len
      }
      const auto = Math.max(col.minWidth ?? 80, Math.min(col.maxWidth ?? 400, maxChars * 9 + 32))
      w[col.key] = col.width ?? auto
    }
    return w
  }, [orderedColumns, sortedData, columnWidths])

  const totalWidth = useMemo(
    () => Object.values(computedWidths).reduce((s, w) => s + (w ?? 100), 0) + S.rowNumW + S.checkboxW,
    [computedWidths],
  )

  const virtualizer = useVirtualizer({
    count: loading ? loadingRows : sortedData.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 15,
  })

  const virtualPageSize = useMemo(() => {
    if (!scrollRef.current) return 20
    const h = scrollRef.current.getBoundingClientRect().height
    return Math.ceil(h / S.rowH)
  }, [])

  const getCellValue = useCallback((rowIndex: number, colIndex: number): string => {
    const row = sortedData[rowIndex]
    if (!row) return ''
    const col = orderedColumns[colIndex]
    if (!col) return ''
    const val = col.accessor
      ? col.accessor(row, rowIndex)
      : ((row as Record<string, unknown>)[col.key] as string | number | null | undefined)
    return val != null && val !== '' ? String(val) : '—'
  }, [sortedData, orderedColumns])

  const handleBatchEdit = useCallback((updates: { rowIndex: number; colIndex: number; value: string }[]) => {
    if (!onCellEdit) return
    // Spec §8.2-8.5: Batch all updates into a single API call
    const batch = updates.map((u) => {
      const row = sortedData[u.rowIndex]
      const col = orderedColumns[u.colIndex]
      if (!row || !col) return null
      const dealId = (row as Record<string, unknown>).id as string | undefined
      if (!dealId) return null
      return { id: dealId, field: col.key, value: u.value }
    }).filter(Boolean) as Array<{ id: string; field: string; value: string }>

    if (batch.length === 0) return

    fetch('/api/deals/batch', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates: batch }),
    }).catch(() => {})

    // Also apply locally for optimistic update
    for (const u of updates) {
      onCellEdit(u.rowIndex, u.colIndex, u.value)
    }
  }, [onCellEdit, sortedData, orderedColumns])

  // ── Save-success flash (declared before handleCellEdit which references it) ──
  const [saveSuccessCell, setSaveSuccessCell] = useState<CellAddress | null>(null)
  const saveSuccessTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showSaveSuccess = useCallback((addr: CellAddress) => {
    setSaveSuccessCell(addr)
    if (saveSuccessTimeoutRef.current) clearTimeout(saveSuccessTimeoutRef.current)
    saveSuccessTimeoutRef.current = setTimeout(() => {
      setSaveSuccessCell(null)
      saveSuccessTimeoutRef.current = null
    }, 1000)
  }, [])

  const handleCellEdit = useCallback((rowIndex: number, colIndex: number, value: string) => {
    const row = sortedData[rowIndex]
    const col = orderedColumns[colIndex]
    if (!row || !col) return
    const dealId = (row as Record<string, unknown>).id as string | undefined
    if (!dealId) return

    fetch(`/api/deals/${dealId}/fields`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [col.key]: value }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          const msg = (body as { errors?: string[] }).errors?.join(', ') || (body as { error?: string }).error || `HTTP ${res.status}`
          throw new Error(msg)
        }
        showSaveSuccess({ rowIndex, colIndex })
      })
      .catch((err) => {
        const label = col.header
        toast.error(`Failed to save "${label}"`, {
          description: err instanceof Error ? err.message : 'Network error',
          action: { label: 'Refresh', onClick: () => window.location.reload() },
        })
      })

    // Optimistic local update — mutate deal_fields so the cell renders the new value immediately
    const rowData = row as Record<string, unknown>
    const dealFields = rowData.deal_fields as Array<{ value: string | null; field_definitions: { key: string } | null }> | null | undefined
    if (dealFields) {
      const existing = dealFields.find((df) => df?.field_definitions?.key === col.key)
      if (existing) {
        existing.value = value
      } else {
        dealFields.push({ value, field_definitions: { key: col.key } })
      }
    }

    onCellEdit?.(rowIndex, colIndex, value)
  }, [onCellEdit, sortedData, orderedColumns, showSaveSuccess])

  const copyHandler = useCallback((ranges: CellRange[]): string[][] => {
    const result: string[][] = []
    for (const range of ranges) {
      const n = rangeNormalize(range)
      for (let r = n.start.rowIndex; r <= n.end.rowIndex; r++) {
        const row: string[] = []
        for (let c = n.start.colIndex; c <= n.end.colIndex; c++) {
          row.push(getCellValue(r, c))
        }
        result.push(row)
      }
    }
    return result
  }, [getCellValue])

  const scrollToRow = useCallback((rowIndex: number) => {
    virtualizer.scrollToIndex(rowIndex, { align: 'auto' })
  }, [virtualizer])

  const scrollToCol = useCallback((colIndex: number) => {
    if (!scrollRef.current) return
    let offset = S.rowNumW
    for (let i = 0; i < colIndex; i++) {
      const col = orderedColumns[i]
      if (col) offset += computedWidths[col.key] ?? 100
    }
    const colW = orderedColumns[colIndex] ? (computedWidths[orderedColumns[colIndex]!.key] ?? 100) : 100
    const containerW = scrollRef.current.clientWidth
    if (offset < scrollRef.current.scrollLeft || offset + colW > scrollRef.current.scrollLeft + containerW) {
      scrollRef.current.scrollLeft = offset
    }
  }, [orderedColumns, computedWidths])

  const excludeColIndices = useMemo(() => {
    const s = new Set<number>()
    s.add(0) // Checkbox column — always excluded from keyboard nav (spec §1.3)
    const lastIdx = orderedColumns.length - 1
    if (lastIdx >= 0 && orderedColumns[lastIdx]!.key === 'actions') {
      s.add(lastIdx)
    }
    return s
  }, [orderedColumns])

  const [flashingCell, setFlashingCell] = useState<CellAddress | null>(null)
  const [validationFlashCell, setValidationFlashCell] = useState<CellAddress | null>(null)
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const validationFlashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleF2NonEditable = useCallback((addr: CellAddress) => {
    setFlashingCell(addr)
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current)
    flashTimeoutRef.current = setTimeout(() => {
      setFlashingCell(null)
      flashTimeoutRef.current = null
    }, 600)
  }, [])

  const handleValidationError = useCallback((addr: CellAddress) => {
    setValidationFlashCell(addr)
    if (validationFlashTimeoutRef.current) clearTimeout(validationFlashTimeoutRef.current)
    validationFlashTimeoutRef.current = setTimeout(() => {
      setValidationFlashCell(null)
      validationFlashTimeoutRef.current = null
    }, 600)
  }, [])

  const validateCell = useCallback((rowIndex: number, colIndex: number, value: string): string | null => {
    if (!onCellEdit) return null
    const col = orderedColumns[colIndex]
    if (!col) return null
    if (value.length > 500) return 'Value must be 500 characters or fewer'
    return null
  }, [orderedColumns, onCellEdit])

  const derivedEditableColumns = useMemo(() => {
    const set = new Set<number>()
    for (let i = 0; i < orderedColumns.length; i++) {
      if (orderedColumns[i]!.editable) set.add(i)
    }
    return set
  }, [orderedColumns])

  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current)
      if (validationFlashTimeoutRef.current) clearTimeout(validationFlashTimeoutRef.current)
      if (saveSuccessTimeoutRef.current) clearTimeout(saveSuccessTimeoutRef.current)
    }
  }, [])

  const interactConfig = {
    rowCount: sortedData.length,
    colCount: orderedColumns.length,
    pageSize: virtualPageSize,
    data: sortedData,
    editableColumns: editableColumns ?? derivedEditableColumns,
    excludeColIndices,
    getCellValue,
    onCellEdit: handleCellEdit,
    onBatchEdit: handleBatchEdit,
    onCopyRequest: copyHandler,
    scrollToRow,
    scrollToCol,
    fullDataset: true,
    totalRowCount: sortedData.length,
    onF2NonEditable: handleF2NonEditable,
    validateCell,
    onValidationError: handleValidationError,
    scrollContainerRef: scrollRef,
  }

  const interaction = useGridInteraction(interactConfig)
  const { state, dispatch } = interaction

  const toggleRowSelection = useCallback((rowIndex: number) => {
    const id = rowKeyRef.current(sortedRef.current[rowIndex]!, rowIndex)
    const next = new Set(selRef.current)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    if (!isControlled) setInternalSelectedIds(next)
    onSelChangeRef.current?.(next)
    // Spec §4.8: clicking checkbox does NOT affect selectionRanges
  }, [isControlled])

  // Tracks whether onSelectAll fired but parent hasn't re-rendered with allRowsSelected=true yet.
  const selectAllPendingRef = useRef(false)

  const toggleAllRows = useCallback(() => {
    // Parent batched setState from prior onSelectAll may not have committed yet.
    // If we called onSelectAll and allRowsSelected is still false, treat this click as deselect.
    if (selectAllPendingRef.current && !allRowsSelected) {
      selectAllPendingRef.current = false
      const next = new Set<string>()
      if (!isControlled) setInternalSelectedIds(next)
      onSelChangeRef.current?.(next)
      return
    }

    const sel = selRef.current
    const rows = sortedRef.current
    if (sel.size > 0) {
      // Any selection (partial, all page, all across pages) → deselect
      selectAllPendingRef.current = false
      const next = new Set<string>()
      if (!isControlled) setInternalSelectedIds(next)
      onSelChangeRef.current?.(next)
    } else {
      // Nothing selected → select all on page
      selectAllPendingRef.current = false
      const next = new Set(rows.map((r, i) => rowKeyRef.current(r, i)))
      if (!isControlled) setInternalSelectedIds(next)
      onSelChangeRef.current?.(next)
    }
  }, [allRowsSelected, isControlled, onSelectAll])

  const onSort = useCallback((key: string) => {
    if (serverSide) {
      const newDir = sortKey === key && sortDir === 'asc' ? 'desc' : 'asc'
      onSortChange?.(key, newDir)
      return
    }
    if (sortKey === key) {
      setInternalSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setInternalSortDir('asc')
      if (!isControlled) setInternalSelectedIds(new Set())
      onSelectionChange?.(new Set())
      dispatch({ type: 'CLEAR_SELECTION' })
    }
    setInternalSortKey(key)
  }, [serverSide, sortKey, sortDir, isControlled, onSelectionChange, onSortChange, dispatch])

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      interaction.onCellMouseUp()
    }
    document.addEventListener('mouseup', handleGlobalMouseUp)
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp)
  }, [interaction])

  const prevFocusCellRef = useRef(state.focusCell)
  const prevEditingCellRef = useRef(state.editingCell)
  const keyboardNavRef = useRef(false)

  const onContainerKeyDown = useCallback((e: React.KeyboardEvent) => {
    keyboardNavRef.current = true
    interaction.onContainerKeyDown(e)
  }, [interaction])

  useEffect(() => {
    if (prevFocusCellRef.current !== state.focusCell && resolvedSelectedIds.size > 0 && keyboardNavRef.current) {
      const next = new Set<string>()
      if (!isControlled) setInternalSelectedIds(next)
      onSelectionChange?.(next)
    }
    prevFocusCellRef.current = state.focusCell
    keyboardNavRef.current = false
  }, [state.focusCell, resolvedSelectedIds, isControlled, onSelectionChange])

  useEffect(() => {
    if (prevEditingCellRef.current && !state.editingCell) {
      gridRef.current?.focus()
    }
    prevEditingCellRef.current = state.editingCell
  }, [state.editingCell])

  const onResizeStart = useCallback((key: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const headerEl = scrollRef.current?.querySelector(`[data-col-key="${key}"]`) as HTMLElement | null
    const gridRect = gridRef.current?.getBoundingClientRect()
    const indicatorLeft = gridRect ? e.clientX - gridRect.left : 0
    setResizeIndicatorX(indicatorLeft)

    const curWidth = computedWidths[key] ?? 100
    const isMulti = selectedColKeys.size > 1 && selectedColKeys.has(key)
    let totalStartWidth = curWidth
    let multiCols: { key: string; startWidth: number; ratio: number; el: HTMLElement | null }[] | null = null
    if (isMulti) {
      let totalW = 0
      const cols: { key: string; startWidth: number; ratio: number; el: HTMLElement | null }[] = []
      for (const colKey of selectedColKeys) {
        const w = computedWidths[colKey] ?? 100
        totalW += w
        const el = scrollRef.current?.querySelector(`[data-col-key="${colKey}"]`) as HTMLElement | null
        cols.push({ key: colKey, startWidth: w, ratio: 0, el })
      }
      for (const c of cols) {
        c.ratio = c.startWidth / totalW
      }
      multiCols = cols
      totalStartWidth = totalW
    }

    resizingRef.current = { key, startX: e.clientX, startWidth: curWidth, totalStartWidth, el: headerEl, multiCols }

    const onMove = (ev: MouseEvent) => {
      if (resizeRafRef.current) cancelAnimationFrame(resizeRafRef.current)
      resizeRafRef.current = requestAnimationFrame(() => {
        if (!resizingRef.current) return
        if (resizingRef.current.multiCols?.length) {
          const delta = ev.clientX - resizingRef.current.startX
          const newTotalWidth = resizingRef.current.totalStartWidth + delta
          for (const mc of resizingRef.current.multiCols) {
            const w = Math.max(60, Math.round(newTotalWidth * mc.ratio))
            if (mc.el) mc.el.style.width = `${w}px`
          }
        } else {
          const delta = ev.clientX - resizingRef.current.startX
          const newWidth = Math.max(60, resizingRef.current.startWidth + delta)
          if (resizingRef.current.el) {
            resizingRef.current.el.style.width = `${newWidth}px`
          }
        }
        if (gridRect) {
          setResizeIndicatorX(ev.clientX - gridRect.left)
        }
      })
    }
    const onUp = () => {
      if (resizingRef.current) {
        const info = resizingRef.current
        const endX = info.lastClientX ?? info.startX
        if (info.multiCols?.length) {
          const delta = endX - info.startX
          const newTotalWidth = info.totalStartWidth + delta
          for (const mc of info.multiCols) {
            const w = Math.max(60, Math.round(newTotalWidth * mc.ratio))
            setColumnWidth(mc.key, w)
            if (mc.el) mc.el.style.width = ''
          }
        } else {
          const finalWidth = Math.max(60, info.startWidth + endX - info.startX)
          setColumnWidth(info.key, finalWidth)
          if (info.el) info.el.style.width = ''
        }
      }
      resizingRef.current = null
      resizeJustOccurredRef.current = true
      setTimeout(() => { resizeJustOccurredRef.current = false }, 50)
      setResizeIndicatorX(null)
      if (resizeRafRef.current) {
        cancelAnimationFrame(resizeRafRef.current)
        resizeRafRef.current = null
      }
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    const onMoveWithRef = (ev: MouseEvent) => {
      if (resizingRef.current) resizingRef.current.lastClientX = ev.clientX
      onMove(ev)
    }
    document.addEventListener('mousemove', onMoveWithRef)
    document.addEventListener('mouseup', onUp)
  }, [computedWidths, setColumnWidth, selectedColKeys])

  const getAutoFitValues = useCallback((colKey: string) => {
    const col = orderedColumns.find((c) => c.key === colKey)
    if (!col) return []
    const values = sortedData.slice(0, 50).map((row, i) => {
      const val = col.accessor
        ? col.accessor(row, i)
        : ((row as Record<string, unknown>)[col.key] as string | number | null | undefined)
      return val != null && val !== '' ? String(val) : ''
    })
    values.push(col.header)
    return values
  }, [orderedColumns, sortedData])

  const onResizeDoubleClick = useCallback((key: string) => {
    const isMulti = selectedColKeys.size > 1 && selectedColKeys.has(key)
    if (isMulti) {
      autoFitSelected(Array.from(selectedColKeys), (colKey) => getAutoFitValues(colKey))
    } else {
      autoFitColumn(key, () => getAutoFitValues(key))
    }
  }, [autoFitColumn, autoFitSelected, selectedColKeys, getAutoFitValues])

  const handleDraftChange = useCallback((val: string) => {
    dispatch({ type: 'SET_DRAFT', value: val })
  }, [dispatch])

  const hasActiveFilter = (topToolbar?.searchValue && topToolbar.searchValue.length > 0) || (filters?.some((f) => f.value != null)) || false
  const showEmptyState = !loading && sortedData.length === 0

  const sortIcon = (col: ColumnDef<T>) => {
    const isSorted = sortKey === col.key
    if (col.sortable === false) return null
    if (isSorted) {
      return sortDir === 'desc'
        ? <ArrowDown className="h-3 w-3 flex-shrink-0" style={{ color: S.accent }} />
        : <ArrowUp className="h-3 w-3 flex-shrink-0" style={{ color: S.accent }} />
    }
    return <ArrowUpDown className="h-3 w-3 flex-shrink-0" style={{ opacity: 0, color: S.headerText }} />
  }

  const focusedId = state.focusCell
    ? `grid-cell-r${state.focusCell.rowIndex}-c${state.focusCell.colIndex}`
    : undefined

  return (
    <div
      ref={gridRef}
      className={`rounded-lg border overflow-hidden relative ${fillHeight ? 'h-full flex flex-col' : ''} ${className ?? ''}`}
      style={{ borderColor: S.containerBorder, background: S.rowEvenBg }}
      suppressHydrationWarning
    >
      {/* Top toolbar — actions, search, filters */}
      {topToolbar && (
        <TopToolbar
          recordLabel={topToolbar.recordLabel}
          selectedCount={resolvedSelectedIds.size}
          selectedIds={[...resolvedSelectedIds]}
          onAdd={topToolbar.onAdd}
          onDelete={topToolbar.onDelete}
          onClearSelection={() => {
            const next = new Set<string>()
            if (!isControlled) setInternalSelectedIds(next)
            onSelectionChange?.(next)
          }}
          actions={topToolbar.actions}
          menuActions={topToolbar.menuActions}
          onClearSort={serverSide
            ? () => onSortChange?.('', 'desc')
            : () => { setInternalSortKey(null); setInternalSortDir('asc') }}
          sortKey={sortKey}
          sortColumnHeader={orderedColumns.find((c) => c.key === sortKey)?.header}
          defaultSortKey="created_at"
          searchValue={topToolbar.searchValue}
          onSearchChange={topToolbar.onSearchChange}
          searchPlaceholder={topToolbar.searchPlaceholder}
          filters={filters}
          activeFilterCount={activeFilterCount}
          onClearFilters={onClearFilters}
        />
      )}

      <div
        ref={scrollRef}
        className="overflow-auto"
        style={fillHeight ? { flex: '1 1 0', minHeight: 0 } : { maxHeight }}
        suppressHydrationWarning
      >
        <div
          role="grid"
          tabIndex={0}
          aria-activedescendant={focusedId}
          onKeyDown={onContainerKeyDown}
          style={{ width: totalWidth, minWidth: '100%', position: 'relative' }}
        >
          {/* Header row */}
          <div
            className="flex sticky top-0 z-20 border-b select-none"
            style={{ height: S.headerH, background: S.headerBg, borderColor: S.headerBorder }}
          >
            {/* Checkbox header */}
            <div
              className="flex-shrink-0 sticky left-0 z-30 flex items-center justify-center border-r"
              style={{ width: S.checkboxW, height: S.headerH, background: S.headerBg, borderColor: S.headerBorder }}
              onClick={(e) => e.stopPropagation()}
            >
              <label
                className="flex items-center justify-center cursor-pointer"
                style={{ width: 18, height: 18 }}
                title={allRowsSelected || allSelected ? 'All rows selected. Click to clear.' : 'Select all on page'}
                onClick={(e) => { e.preventDefault(); toggleAllRows() }}
              >
                <div
                  className="flex items-center justify-center rounded transition-colors"
                  style={{
                    width: 16, height: 16,
                    border: `1.5px solid ${allSelected || (allRowsSelected && resolvedSelectedIds.size > 0) || someSelected ? S.accent : 'var(--color-text-tertiary)'}`,
                    background: allSelected || (allRowsSelected && resolvedSelectedIds.size > 0) ? S.accent : someSelected ? 'var(--color-accent-bg)' : 'transparent',
                  }}
                >
                  {allRowsSelected && resolvedSelectedIds.size > 0 ? (
                    <Check className="h-3 w-3" style={{ color: 'var(--color-text-inverse)' }} strokeWidth={3} />
                  ) : allSelected ? (
                    <Check className="h-3 w-3" style={{ color: 'var(--color-text-inverse)' }} strokeWidth={3} />
                  ) : someSelected ? (
                    <Minus className="h-3 w-3" style={{ color: 'var(--accent)' }} strokeWidth={3} />
                  ) : null}
                </div>
              </label>
            </div>

            <div
              className="flex-shrink-0 sticky left-[40px] z-20 flex items-center justify-end px-2 text-[10px] font-semibold border-r"
              style={{ width: S.rowNumW, height: S.headerH, background: S.headerBg, borderColor: S.headerBorder, color: S.rowNumText }}
            >
              #
            </div>
            {orderedColumns.map((col) => {
              const w = computedWidths[col.key] ?? 100
              const isActionsCol = col.key === 'actions'
              const isColSelected = selectedColKeys.has(col.key)
              const isDraggable = columnOrderStorageKey != null && !isActionsCol
              const isDropTarget = dragOverKey === col.key
              return (
                <div
                  key={col.key}
                  data-col-key={col.key}
                  draggable={isDraggable || undefined}
                  onDragStart={(e) => {
                    if (!isDraggable) return
                    dragSourceKeyRef.current = col.key
                    e.dataTransfer.effectAllowed = 'move'
                    e.dataTransfer.setData('text/plain', col.key)
                  }}
                  onDragOver={(e) => {
                    if (!columnOrderStorageKey || isActionsCol) return
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    setDragOverKey(col.key)
                  }}
                  onDragLeave={(e) => {
                    if (!columnOrderStorageKey) return
                    // Only clear if actually leaving this element
                    const rect = e.currentTarget.getBoundingClientRect()
                    const x = e.clientX
                    const y = e.clientY
                    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
                      setDragOverKey(null)
                    }
                  }}
                  onDrop={(e) => {
                    if (!columnOrderStorageKey || isActionsCol) return
                    e.preventDefault()
                    const sourceKey = e.dataTransfer.getData('text/plain')
                    if (!sourceKey || sourceKey === col.key) {
                      setDragOverKey(null)
                      return
                    }
                    const fromIndex = orderedColumns.findIndex((c) => c.key === sourceKey)
                    const toIndex = orderedColumns.findIndex((c) => c.key === col.key)
                    if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
                      onReorder(fromIndex, toIndex)
                    }
                    setDragOverKey(null)
                    dragSourceKeyRef.current = null
                  }}
                  onDragEnd={() => {
                    setDragOverKey(null)
                    dragSourceKeyRef.current = null
                  }}
                  className={`relative flex-shrink-0 flex items-center gap-1 px-3 text-[11px] font-medium uppercase tracking-[0.06em] border-r select-none ${isActionsCol ? 'sticky right-0 z-20' : ''}`}
                  style={{
                    width: w, height: S.headerH, borderColor: S.headerBorder, color: S.headerText,
                    background: isColSelected ? S.accentBg : S.headerBg,
                    justifyContent: col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start',
                    cursor: isDraggable ? (col.sortable !== false ? 'grab' : 'grab') : (col.sortable !== false ? 'pointer' : 'default'),
                    borderLeftColor: isDropTarget ? S.accent : undefined,
                    borderLeftWidth: isDropTarget ? '2px' : undefined,
                    borderLeftStyle: isDropTarget ? 'solid' : undefined,
                  }}
                  onClick={(e) => {
                    if (resizeJustOccurredRef.current) return
                    if (e.shiftKey && col.sortable !== false) {
                      e.preventDefault()
                      const selectableKeys = orderedColumns.filter((c) => c.key !== 'actions').map((c) => c.key)
                      if (!lastShiftClickColRef.current) {
                        lastShiftClickColRef.current = col.key
                        setSelectedColKeys(new Set([col.key]))
                      } else {
                        const lastIdx = selectableKeys.indexOf(lastShiftClickColRef.current)
                        const curIdx = selectableKeys.indexOf(col.key)
                        if (lastIdx !== -1 && curIdx !== -1) {
                          const start = Math.min(lastIdx, curIdx)
                          const end = Math.max(lastIdx, curIdx)
                          setSelectedColKeys(new Set(selectableKeys.slice(start, end + 1)))
                          lastShiftClickColRef.current = col.key
                        }
                      }
                    } else {
                      setSelectedColKeys(new Set())
                      lastShiftClickColRef.current = null
                      if (col.sortable !== false) onSort(col.key)
                    }
                  }}
                  role="columnheader"
                  id={`grid-header-c${orderedColumns.indexOf(col)}`}
                >
                  {col.headerRender ? col.headerRender(col) : <span className="truncate">{col.header}</span>}
                  {sortIcon(col)}
                  <div
                    className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize z-20 transition-opacity"
                    style={{ opacity: 0.6 }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = S.accent
                      e.currentTarget.style.opacity = '1'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.opacity = '0.6'
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      onResizeStart(col.key, e)
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      onResizeDoubleClick(col.key)
                    }}
                  />
                </div>
              )
            })}
          </div>

          {/* Body */}
          <div style={{ height: showEmptyState ? 120 : virtualizer.getTotalSize(), position: 'relative' }}>
            {showEmptyState ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 select-none" style={{ color: S.cellText }}>
                <span className="text-[13px]">
                  {hasActiveFilter
                    ? `No results for '${topToolbar?.searchValue ?? ''}'`
                    : emptyMessage}
                </span>
                {hasActiveFilter ? (
                  <button
                    onClick={() => {
                      topToolbar?.onSearchChange?.('')
                      onClearFilters?.()
                    }}
                    className="text-[12px] font-medium px-3 py-1 rounded-md transition-colors"
                    style={{ color: 'var(--accent)', background: 'var(--color-accent-bg)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-accent)'; e.currentTarget.style.color = 'var(--color-text-inverse)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-accent-bg)'; e.currentTarget.style.color = 'var(--accent)' }}
                  >
                    Clear filter
                  </button>
                ) : emptyAction ? (
                  <button
                    onClick={emptyAction.onClick}
                    className="text-[13px] font-medium px-4 py-2 rounded-lg transition-colors"
                    style={{ background: 'var(--color-accent)', color: 'var(--color-text-inverse)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9' }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
                  >
                    {emptyAction.label}
                  </button>
                ) : null}
              </div>
            ) : loading
              ? virtualizer.getVirtualItems().map((vi) => (
                  <div
                    key={vi.key}
                    className="flex absolute top-0 left-0 border-b"
                    style={{ height: vi.size, width: '100%', transform: `translateY(${vi.start}px)`, borderColor: S.rowBorder }}
                  >
                    <div className="flex-shrink-0 sticky left-0 z-20 flex items-center justify-center border-r" style={{ width: S.checkboxW, borderColor: S.rowBorder, background: S.rowEvenBg }}>
                    </div>
                    <div className="flex-shrink-0 sticky left-[40px] z-10 flex items-center justify-end px-2 border-r" style={{ width: S.rowNumW, borderColor: S.rowBorder, background: S.rowEvenBg }}>
                      <div className="h-3 w-8 rounded" style={{ background: `linear-gradient(90deg, ${S.skelShimmer1} 25%, ${S.skelShimmer2} 50%, ${S.skelShimmer1} 75%)`, backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
                    </div>
                    {orderedColumns.map((col) => {
                      const wc = computedWidths[col.key] ?? 100
                      return (
                        <div key={col.key} className="flex-shrink-0 flex items-center px-3 border-r" style={{ width: wc, height: vi.size, borderColor: S.rowBorder }}>
                          <div className="h-3 rounded w-3/4" style={{ background: `linear-gradient(90deg, ${S.skelShimmer1} 25%, ${S.skelShimmer2} 50%, ${S.skelShimmer1} 75%)`, backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
                        </div>
                      )
                    })}
                  </div>
                ))
              : virtualizer.getVirtualItems().map((vi) => {
                  const row = sortedData[vi.index]
                  if (!row) return null
                  return (
                    <div
                      key={rowKey(row, vi.index)}
                      className="flex absolute top-0 left-0"
                      style={{ height: vi.size, width: '100%', transform: `translateY(${vi.start}px)` }}
                    >
                      <RowRenderer
                        row={row as T}
                        rowIndex={vi.index}
                        columns={orderedColumns as unknown as ColumnDef<unknown>[]}
                        computedWidths={computedWidths}
                        isEven={vi.index % 2 === 0}
                        onRowClick={onRowClick as unknown as ((row: unknown, index: number) => void)}
                        interactionState={state}
                        interactionHandlers={{
                          onCellMouseDown: interaction.onCellMouseDown,
                          onCellMouseEnter: interaction.onCellMouseEnter,
                          onCellMouseUp: interaction.onCellMouseUp,
                          onCellDoubleClick: interaction.onCellDoubleClick,
                          onCellClick: interaction.onCellClick,
                        }}
                        editingValue={state.draftValue}
                        onDraftChange={handleDraftChange}
                        commitEdit={interaction.commitEdit}
                        onRowKeyDown={interaction.onContainerKeyDown}
                        isSelected={resolvedSelectedIds.has(rowKey(row, vi.index))}
                        onCheckboxToggle={toggleRowSelection}
                        flashingCell={flashingCell}
                        validationFlashCell={validationFlashCell}
                        saveSuccessCell={saveSuccessCell}
                        editComponents={editComponents}
                      />
                    </div>
                  )
                })}
          </div>
        </div>
      </div>

      {/* Selection range overlay — positioned relative to scroll container */}
      {state.selectionRanges.length > 0 && state.selectionRanges.every((r) => {
        const n = rangeNormalize(r)
        return n.start.rowIndex !== n.end.rowIndex || n.start.colIndex !== n.end.colIndex
      }) && (
        <div className="relative" style={{ height: 0 }}>
          {state.selectionRanges.map((range, i) => {
            const n = rangeNormalize(range)
            if (n.start.rowIndex === n.end.rowIndex && n.start.colIndex === n.end.colIndex) return null
            let left = S.checkboxW + S.rowNumW
            let top = 0
            let width = 0
            let heightVal = 0

            for (let c = 0; c < n.start.colIndex; c++) {
              const col = orderedColumns[c]
              if (col) left += computedWidths[col.key] ?? 100
            }
            for (let c = n.start.colIndex; c <= n.end.colIndex; c++) {
              const col = orderedColumns[c]
              if (col) width += computedWidths[col.key] ?? 100
            }

            const vItems = virtualizer.getVirtualItems()
            const firstVis = vItems[0]
            const lastVis = vItems[vItems.length - 1]
            if (!firstVis || !lastVis) return null

            const firstRow = Math.max(n.start.rowIndex, firstVis.index)
            const lastRow = Math.min(n.end.rowIndex, lastVis.index)

            if (firstRow > lastRow) return null

            if (firstRow === n.start.rowIndex) {
              top = (firstRow - firstVis.index) * S.rowH
            } else {
              top = 0
            }

            if (firstRow === n.start.rowIndex && lastRow === n.end.rowIndex) {
              heightVal = (n.end.rowIndex - n.start.rowIndex + 1) * S.rowH
            } else if (firstRow === n.start.rowIndex) {
              heightVal = (lastRow - n.start.rowIndex + 1) * S.rowH
            } else if (lastRow === n.end.rowIndex) {
              heightVal = (n.end.rowIndex - firstRow + 1) * S.rowH
            } else {
              heightVal = (lastRow - firstRow + 1) * S.rowH
            }

            top += firstVis.start

            return (
              <div
                key={i}
                className="absolute pointer-events-none z-20"
                style={{
                  left, top, width, height: heightVal,
                  border: `1px solid ${S.accent}`,
                }}
              />
            )
          })}
        </div>
      )}

      {/* Toolbar — row count / selection actions / pagination */}
      <Toolbar
          sortedDataLength={sortedData.length}
          sortKey={sortKey}
          sortColumnHeader={orderedColumns.find((c) => c.key === sortKey)?.header}
          defaultSortKey="created_at"
          selectedCount={resolvedSelectedIds.size}
          selectedIds={[...resolvedSelectedIds]}
          selectionActions={selectionActions}
          selectionMenuActions={selectionMenuActions}
          bulkActions={bulkActions}
          onClearSelection={() => {
            const next = new Set<string>()
            if (!isControlled) setInternalSelectedIds(next)
            onSelectionChange?.(next)
          }}
          pagination={
            totalRows != null && page != null && pageSize != null && onPageChange
              ? { totalRows, page, pageSize, onPageChange, onPageSizeChange, pageSizes }
              : undefined
          }
        />

      {/* Resize drag indicator */}
      {resizeIndicatorX !== null && (
        <div
          className="absolute top-0 bottom-0 pointer-events-none z-50"
          style={{
            left: resizeIndicatorX,
            width: 2,
            background: 'var(--color-accent)',
          }}
        />
      )}

      {/* Drag selection overlay — prevents text selection during drag (spec §5.2) */}
      {state.mode === 'CELL_RANGE' && state.selectionRanges.length > 0 && state.selectionRanges.some((r) => {
        const n = rangeNormalize(r)
        return n.start.rowIndex !== n.end.rowIndex || n.start.colIndex !== n.end.colIndex
      }) && (
        <div
          className="fixed inset-0 z-[100]"
          style={{ cursor: 'default' }}
        />
      )}

      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  )
}
