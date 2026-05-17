'use client'

import { useRef, useState, useCallback, useMemo, useEffect, memo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowUpDown, ArrowUp, ArrowDown, Check, Minus } from 'lucide-react'
import { useGridInteraction } from '@/lib/hooks/useGridInteraction'
import { useColumnWidths } from '@/lib/hooks/useColumnWidths'

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
  bulkActions?: (selectedCount: number) => React.ReactNode
}

const CHECKBOX_COL_W = 40

const S = {
  headerH: 36,
  rowH: 40,
  footerH: 32,
  checkboxW: CHECKBOX_COL_W,
  rowNumW: 44,
  headerBg: 'var(--color-surface-1)',
  headerText: 'var(--color-text-tertiary)',
  headerBorder: 'var(--color-surface-3)',
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
  interactionHandlers: Pick<ReturnType<typeof useGridInteraction>, 'onCellMouseDown' | 'onCellMouseEnter' | 'onCellMouseUp' | 'onCellDoubleClick'>
  editingValue: string
  onDraftChange: (val: string) => void
  commitEdit: () => void
  onRowKeyDown: (e: React.KeyboardEvent) => void
  isSelected: boolean
  onCheckboxToggle: (rowIndex: number) => void
  flashingCell: CellAddress | null
  validationFlashCell: CellAddress | null
  editComponents?: Record<number, (props: { value: string; rowIndex: number; onChange: (val: string) => void; onCommit: () => void; onDiscard: () => void; cellEl?: HTMLElement | null }) => React.ReactNode>
}

const RowRenderer = memo(function RowRendererInner<T>({
  row, rowIndex, columns, computedWidths, isEven, onRowClick,
  interactionState, interactionHandlers, editingValue, onDraftChange, commitEdit, onRowKeyDown,
  isSelected, onCheckboxToggle, flashingCell, validationFlashCell, editComponents,
}: RowRendererProps<T>) {
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
        cursor: onRowClick ? 'pointer' : 'default',
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
          borderColor: S.rowBorder, background: 'transparent',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <label className="flex items-center justify-center cursor-pointer" style={{ width: 18, height: 18 }}>
          <input
            type="checkbox"
            checked={isSelected}
            className="sr-only"
            onChange={() => onCheckboxToggle(rowIndex)}
          />
          <div
            className="flex items-center justify-center rounded transition-colors"
            style={{
              width: 16, height: 16,
              border: `1.5px solid ${isSelected ? S.accent : 'var(--color-surface-3)'}`,
              background: isSelected ? S.accent : 'transparent',
            }}
          >
            {isSelected && <Check className="h-3 w-3" style={{ color: '#fff' }} strokeWidth={3} />}
          </div>
        </label>
      </div>

      {/* Row number */}
      <div
        className="flex-shrink-0 sticky left-[40px] z-10 flex items-center justify-end px-2 text-[11px] border-r select-none tabular-nums"
        style={{ width: S.rowNumW, height: S.rowH, borderColor: S.rowBorder, background: 'transparent', color: S.rowNumText }}
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
                    borderRadius: 0,
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
  className,
  editableColumns,
  onCellEdit,
  editComponents,
  selectedRowIds: controlledSelectedRowIds,
  onSelectionChange,
  bulkActions,
}: DataGridProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const { widths: columnWidths, setWidth: setColumnWidth, autoFitColumn, autoFitSelected } = useColumnWidths()
  const [resizeIndicatorX, setResizeIndicatorX] = useState<number | null>(null)
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
    if (!sortKey) return data
    const col = columns.find((c) => c.key === sortKey)
    if (!col) return data
    const getter = col.accessor ?? ((r: T) => (r as Record<string, unknown>)[col.key] as string | number | null | undefined)
    return [...data].sort((a, b) => {
      const va = getter(a, 0) ?? ''
      const vb = getter(b, 0) ?? ''
      const cmp = va < vb ? -1 : va > vb ? 1 : 0
      return sortDir === 'desc' ? -cmp : cmp
    })
  }, [data, sortKey, sortDir, columns])

  const allSelected = sortedData.length > 0 && resolvedSelectedIds.size === sortedData.length
  const someSelected = resolvedSelectedIds.size > 0 && !allSelected

  const computedWidths = useMemo(() => {
    const w: Record<string, number> = {}
    const sample = sortedData.slice(0, 50)
    for (const col of columns) {
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
  }, [columns, sortedData, columnWidths])

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

  const pageSize = useMemo(() => {
    if (!scrollRef.current) return 20
    const h = scrollRef.current.getBoundingClientRect().height
    return Math.ceil(h / S.rowH)
  }, [])

  const getCellValue = useCallback((rowIndex: number, colIndex: number): string => {
    const row = sortedData[rowIndex]
    if (!row) return ''
    const col = columns[colIndex]
    if (!col) return ''
    const val = col.accessor
      ? col.accessor(row, rowIndex)
      : ((row as Record<string, unknown>)[col.key] as string | number | null | undefined)
    return val != null && val !== '' ? String(val) : '—'
  }, [sortedData, columns])

  const handleBatchEdit = useCallback((updates: { rowIndex: number; colIndex: number; value: string }[]) => {
    if (!onCellEdit) return
    // Spec §8.2-8.5: Batch all updates into a single API call
    const batch = updates.map((u) => {
      const row = sortedData[u.rowIndex]
      const col = columns[u.colIndex]
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
  }, [onCellEdit, sortedData, columns])

  const handleCellEdit = useCallback((rowIndex: number, colIndex: number, value: string) => {
    if (!onCellEdit) return
    onCellEdit(rowIndex, colIndex, value)
  }, [onCellEdit])

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
      const col = columns[i]
      if (col) offset += computedWidths[col.key] ?? 100
    }
    const colW = columns[colIndex] ? (computedWidths[columns[colIndex]!.key] ?? 100) : 100
    const containerW = scrollRef.current.clientWidth
    if (offset < scrollRef.current.scrollLeft || offset + colW > scrollRef.current.scrollLeft + containerW) {
      scrollRef.current.scrollLeft = offset
    }
  }, [columns, computedWidths])

  const excludeColIndices = useMemo(() => {
    const s = new Set<number>()
    s.add(0) // Checkbox column — always excluded from keyboard nav (spec §1.3)
    const lastIdx = columns.length - 1
    if (lastIdx >= 0 && columns[lastIdx]!.key === 'actions') {
      s.add(lastIdx)
    }
    return s
  }, [columns])

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
    const col = columns[colIndex]
    if (!col) return null
    if (col.key === 'deal_name') {
      if (!value || value.trim().length === 0) return 'Property name cannot be empty'
      if (value.length > 200) return 'Property name must be 200 characters or fewer'
    }
    if (col.key === 'address') {
      if (value.length > 300) return 'Address must be 300 characters or fewer'
    }
    if (col.key === 'unit_count') {
      if (value === '') return null
      const n = parseInt(value, 10)
      if (isNaN(n) || n < 0) return 'Units must be a positive number'
    }
    return null
  }, [columns, onCellEdit])

  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current)
      if (validationFlashTimeoutRef.current) clearTimeout(validationFlashTimeoutRef.current)
    }
  }, [])

  const interactConfig = {
    rowCount: sortedData.length,
    colCount: columns.length,
    pageSize,
    data: sortedData,
    editableColumns: editableColumns ?? new Set(),
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
    const id = rowKey(sortedData[rowIndex]!, rowIndex)
    const next = new Set(resolvedSelectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    if (!isControlled) setInternalSelectedIds(next)
    onSelectionChange?.(next)
    // Spec §4.8: clicking checkbox does NOT affect selectionRanges
  }, [resolvedSelectedIds, sortedData, rowKey, isControlled, onSelectionChange])

  const toggleAllRows = useCallback(() => {
    if (resolvedSelectedIds.size === sortedData.length) {
      const next = new Set<string>()
      if (!isControlled) setInternalSelectedIds(next)
      onSelectionChange?.(next)
    } else {
      const next = new Set(sortedData.map((r, i) => rowKey(r, i)))
      if (!isControlled) setInternalSelectedIds(next)
      onSelectionChange?.(next)
    }
  }, [resolvedSelectedIds, sortedData, rowKey, isControlled, onSelectionChange])

  const onSort = useCallback((key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortDir('asc')
      if (!isControlled) setInternalSelectedIds(new Set())
      onSelectionChange?.(new Set())
      dispatch({ type: 'CLEAR_SELECTION' })
    }
    setSortKey(key)
  }, [sortKey, isControlled, onSelectionChange, dispatch])

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
    const col = columns.find((c) => c.key === colKey)
    if (!col) return []
    const values = sortedData.slice(0, 50).map((row, i) => {
      const val = col.accessor
        ? col.accessor(row, i)
        : ((row as Record<string, unknown>)[col.key] as string | number | null | undefined)
      return val != null && val !== '' ? String(val) : ''
    })
    values.push(col.header)
    return values
  }, [columns, sortedData])

  const applyWidthToColumnElements = useCallback((colKey: string, width: number) => {
    if (!scrollRef.current) return
    const headerEl = scrollRef.current.querySelector(`[data-col-key="${colKey}"]`) as HTMLElement | null
    if (headerEl) headerEl.style.width = `${width}px`
    const colIndex = columns.findIndex((c) => c.key === colKey)
    if (colIndex >= 0) {
      const cellEls = scrollRef.current.querySelectorAll(`[id^="grid-cell-r"][id$="-c${colIndex}"]`)
      for (const el of cellEls) {
        (el as HTMLElement).style.width = `${width}px`
      }
    }
  }, [columns])

  const onResizeDoubleClick = useCallback((key: string) => {
    const isMulti = selectedColKeys.size > 1 && selectedColKeys.has(key)
    if (isMulti) {
      const widths = autoFitSelected(Array.from(selectedColKeys), (colKey) => getAutoFitValues(colKey))
      for (const [colKey, w] of Object.entries(widths)) {
        applyWidthToColumnElements(colKey, w)
      }
    } else {
      const w = autoFitColumn(key, () => getAutoFitValues(key))
      applyWidthToColumnElements(key, w)
    }
  }, [autoFitColumn, autoFitSelected, selectedColKeys, getAutoFitValues, applyWidthToColumnElements])

  const handleDraftChange = useCallback((val: string) => {
    dispatch({ type: 'SET_DRAFT', value: val })
  }, [dispatch])

  if (!loading && sortedData.length === 0) {
    return (
      <div className={`rounded-lg border ${className ?? ''}`} style={{ borderColor: S.containerBorder, background: S.rowEvenBg }}>
        <div className="flex flex-col items-center justify-center py-16 text-[13px] select-none gap-3" style={{ color: S.cellText }}>
          <span>{emptyMessage}</span>
          {emptyAction && (
            <button
              onClick={emptyAction.onClick}
              className="text-[13px] font-medium px-4 py-2 rounded-lg transition-colors"
              style={{ background: 'var(--color-accent)', color: '#fff' }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9' }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
            >
              {emptyAction.label}
            </button>
          )}
        </div>
      </div>
    )
  }

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
      className={`rounded-lg border overflow-hidden relative ${className ?? ''}`}
      style={{ borderColor: S.containerBorder, background: S.rowEvenBg }}
      suppressHydrationWarning
    >
      <div
        ref={scrollRef}
        className="overflow-auto"
        style={{ maxHeight }}
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
              <label className="flex items-center justify-center cursor-pointer" style={{ width: 18, height: 18 }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  className="sr-only"
                  onChange={toggleAllRows}
                />
                <div
                  className="flex items-center justify-center rounded transition-colors"
                  style={{
                    width: 16, height: 16,
                    border: `1.5px solid ${allSelected || someSelected ? S.accent : 'var(--color-surface-3)'}`,
                    background: allSelected ? S.accent : someSelected ? 'var(--color-accent-bg)' : 'transparent',
                  }}
                >
                  {allSelected && <Check className="h-3 w-3" style={{ color: '#fff' }} strokeWidth={3} />}
                  {someSelected && <Minus className="h-3 w-3" style={{ color: 'var(--accent)' }} strokeWidth={3} />}
                </div>
              </label>
            </div>

            <div
              className="flex-shrink-0 sticky left-[40px] z-20 flex items-center justify-end px-2 text-[10px] font-semibold border-r"
              style={{ width: S.rowNumW, height: S.headerH, background: S.headerBg, borderColor: S.headerBorder, color: S.rowNumText }}
            >
              #
            </div>
            {columns.map((col) => {
              const w = computedWidths[col.key] ?? 100
        const isActionsCol = col.key === 'actions'
        const isColSelected = selectedColKeys.has(col.key)
              return (
                <div
                  key={col.key}
                  data-col-key={col.key}
                  className={`relative flex-shrink-0 flex items-center gap-1 px-3 text-[11px] font-medium uppercase tracking-[0.06em] border-r select-none ${isActionsCol ? 'sticky right-0 z-20' : ''}`}
                  style={{
                    width: w, height: S.headerH, borderColor: S.headerBorder, color: S.headerText,
                    background: isColSelected ? S.accentBg : S.headerBg,
                    justifyContent: col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start',
                    cursor: col.sortable !== false ? 'pointer' : 'default',
                  }}
                  onClick={(e) => {
                    if (e.shiftKey && col.sortable !== false) {
                      e.preventDefault()
                      const selectableKeys = columns.filter((c) => c.key !== 'actions').map((c) => c.key)
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
                  id={`grid-header-c${columns.indexOf(col)}`}
                >
                  <span className="truncate">{col.header}</span>
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
                    onMouseDown={(e) => onResizeStart(col.key, e)}
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
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {loading
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
                    {columns.map((col) => {
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
                      onClick={() => onRowClick?.(row, vi.index)}
                    >
                      <RowRenderer
                        row={row as T}
                        rowIndex={vi.index}
                        columns={columns as unknown as ColumnDef<unknown>[]}
                        computedWidths={computedWidths}
                        isEven={vi.index % 2 === 0}
                        onRowClick={onRowClick as unknown as ((row: unknown, index: number) => void)}
                        interactionState={state}
                        interactionHandlers={{
                          onCellMouseDown: interaction.onCellMouseDown,
                          onCellMouseEnter: interaction.onCellMouseEnter,
                          onCellMouseUp: interaction.onCellMouseUp,
                          onCellDoubleClick: interaction.onCellDoubleClick,
                        }}
                        editingValue={state.draftValue}
                        onDraftChange={handleDraftChange}
                        commitEdit={interaction.commitEdit}
                        onRowKeyDown={interaction.onContainerKeyDown}
                        isSelected={resolvedSelectedIds.has(rowKey(row, vi.index))}
                        onCheckboxToggle={toggleRowSelection}
                        flashingCell={flashingCell}
                        validationFlashCell={validationFlashCell}
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
              const col = columns[c]
              if (col) left += computedWidths[col.key] ?? 100
            }
            for (let c = n.start.colIndex; c <= n.end.colIndex; c++) {
              const col = columns[c]
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

      {/* Footer */}
      {!loading && (
        <div
          className="flex items-center px-3 border-t text-[11px] select-none"
          style={{ height: S.footerH, background: S.footerBg, borderColor: S.footerBorder, color: S.rowNumText, fontFamily: 'var(--font-jetbrains-mono)' }}
        >
          {sortedData.length.toLocaleString()} row{sortedData.length !== 1 ? 's' : ''}
          {sortKey && (
            <span style={{ color: S.cellText }}>
              {' · sorted by '}{columns.find((c) => c.key === sortKey)?.header ?? sortKey}
            </span>
          )}
        </div>
      )}

      {/* Bulk actions bar */}
      {resolvedSelectedIds.size > 0 && (
        <div
          className="flex items-center justify-between px-4 border-t select-none"
          style={{
            height: 44,
            background: 'var(--color-accent-bg)',
            borderColor: S.accent,
          }}
        >
          <span className="text-[13px] font-medium" style={{ color: 'var(--color-text-primary)' }}>
            {resolvedSelectedIds.size} selected
          </span>
          <div className="flex items-center gap-2">
            {bulkActions?.(resolvedSelectedIds.size)}
            <button
              onClick={() => {
                const next = new Set<string>()
                if (!isControlled) setInternalSelectedIds(next)
                onSelectionChange?.(next)
              }}
              className="text-[12px] font-medium px-3 py-1.5 rounded transition-colors"
              style={{ color: 'var(--color-text-secondary)', background: 'var(--color-surface-1)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-2)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-surface-1)' }}
            >
              Clear selection
            </button>
          </div>
        </div>
      )}

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
