'use client'

import { useReducer, useCallback, useRef, useEffect } from 'react'
import type { CellAddress, CellRange, GridInteractionState } from '@/lib/types/grid'
import { cellAddressEqual, isInRange, rangeNormalize } from '@/lib/types/grid'
import { toast } from 'sonner'

type Action =
  | { type: 'MOVE_FOCUS'; rowDelta: number; colDelta: number; rowCount: number; colCount: number; data: unknown[]; getCellValue: (rowIndex: number, colIndex: number) => string }
  | { type: 'JUMP_BOUNDARY'; direction: 'up' | 'down' | 'left' | 'right'; rowCount: number; colCount: number; data: unknown[]; getCellValue: (rowIndex: number, colIndex: number) => string; excludeColIndices?: Set<number> }
  | { type: 'JUMP_HOME'; ctrl: boolean; rowCount: number; colCount: number }
  | { type: 'JUMP_END'; ctrl: boolean; rowCount: number; colCount: number }
  | { type: 'PAGE_UP_DOWN'; direction: 'up' | 'down'; pageSize: number; rowCount: number; colCount: number }
  | { type: 'EXTEND_RANGE'; rowDelta: number; colDelta: number; rowCount: number; colCount: number; data: unknown[]; getCellValue: (rowIndex: number, colIndex: number) => string }
  | { type: 'EXTEND_BOUNDARY'; direction: 'up' | 'down' | 'left' | 'right'; rowCount: number; colCount: number; data: unknown[]; getCellValue: (rowIndex: number, colIndex: number) => string; excludeColIndices?: Set<number> }
  | { type: 'EXTEND_HOME'; ctrl: boolean; rowCount: number; colCount: number }
  | { type: 'EXTEND_END'; ctrl: boolean; rowCount: number; colCount: number }
  | { type: 'EXTEND_PAGE_UP_DOWN'; direction: 'up' | 'down'; pageSize: number; rowCount: number; colCount: number }
  | { type: 'SET_FOCUS'; address: CellAddress }
  | { type: 'SET_ANCHOR'; address: CellAddress }
  | { type: 'START_DRAG'; address: CellAddress }
  | { type: 'UPDATE_DRAG'; address: CellAddress }
  | { type: 'END_DRAG' }
  | { type: 'ADD_RANGE'; address: CellAddress }
  | { type: 'SELECT_ALL'; pageRowCount: number; colCount: number; fullDataset: boolean; totalRowCount?: number }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'START_EDIT'; address: CellAddress; value: string }
  | { type: 'SET_DRAFT'; value: string }
  | { type: 'COMMIT_EDIT' }
  | { type: 'DISCARD_EDIT' }
  | { type: 'TAB_NEXT'; rowCount: number; colCount: number }
  | { type: 'TAB_PREV'; rowCount: number; colCount: number }
  | { type: 'ENTER_NEXT'; rowCount: number; colCount: number }
  | { type: 'ENTER_PREV'; rowCount: number; colCount: number }
  | { type: 'SET_MODE_ROW' }
  | { type: 'CLEAR_ROW_SELECTION' }
  | { type: 'SHIFT_CLICK_RANGE'; anchor: CellAddress; clickAddress: CellAddress }

function clampRow(ri: number, rowCount: number): number {
  return Math.max(0, Math.min(ri, rowCount - 1))
}

function clampCol(ci: number, colCount: number): number {
  return Math.max(0, Math.min(ci, colCount - 1))
}

function moveAddress(
  addr: CellAddress,
  rowDelta: number,
  colDelta: number,
  rowCount: number,
  colCount: number,
): CellAddress {
  return {
    rowIndex: clampRow(addr.rowIndex + rowDelta, rowCount),
    colIndex: clampCol(addr.colIndex + colDelta, colCount),
  }
}

function jumpBoundary(
  addr: CellAddress,
  direction: 'up' | 'down' | 'left' | 'right',
  rowCount: number,
  colCount: number,
  data: unknown[],
  getCellValue: (rowIndex: number, colIndex: number) => string,
  excludeColIndices?: Set<number>,
): CellAddress {
  const result = { ...addr }
  if (direction === 'right') {
    const cur = getCellValue(result.rowIndex, result.colIndex)
    const isEmpty = !cur || cur === '—'
    if (isEmpty) {
      result.colIndex = clampCol(result.colIndex + 1, colCount)
    } else {
      while (result.colIndex < colCount - 1) {
        const next = getCellValue(result.rowIndex, result.colIndex + 1)
        if (!next || next === '—') break
        result.colIndex++
      }
    }
    // Skip excluded columns (spec §3.6)
    while (excludeColIndices?.has(result.colIndex) && result.colIndex < colCount - 1) {
      result.colIndex++
    }
  } else if (direction === 'left') {
    const cur = getCellValue(result.rowIndex, result.colIndex)
    const isEmpty = !cur || cur === '—'
    if (isEmpty) {
      result.colIndex = clampCol(result.colIndex - 1, colCount)
    } else {
      while (result.colIndex > 0) {
        const prev = getCellValue(result.rowIndex, result.colIndex - 1)
        if (!prev || prev === '—') break
        result.colIndex--
      }
    }
    while (excludeColIndices?.has(result.colIndex) && result.colIndex > 0) {
      result.colIndex--
    }
  } else if (direction === 'down') {
    const cur = getCellValue(result.rowIndex, result.colIndex)
    const isEmpty = !cur || cur === '—'
    if (isEmpty) {
      result.rowIndex = clampRow(result.rowIndex + 1, rowCount)
    } else {
      while (result.rowIndex < rowCount - 1) {
        const next = getCellValue(result.rowIndex + 1, result.colIndex)
        if (!next || next === '—') break
        result.rowIndex++
      }
    }
  } else if (direction === 'up') {
    const cur = getCellValue(result.rowIndex, result.colIndex)
    const isEmpty = !cur || cur === '—'
    if (isEmpty) {
      result.rowIndex = clampRow(result.rowIndex - 1, rowCount)
    } else {
      while (result.rowIndex > 0) {
        const prev = getCellValue(result.rowIndex - 1, result.colIndex)
        if (!prev || prev === '—') break
        result.rowIndex--
      }
    }
  }
  return result
}

function skipExcludedCol(
  colIndex: number,
  delta: number,
  colCount: number,
  exclude: Set<number>,
): number {
  let ci = colIndex + delta
  if (ci < 0) {
    ci = 0
    while (exclude.has(ci) && ci < colCount - 1) ci++
  } else if (ci >= colCount) {
    ci = colCount - 1
    while (exclude.has(ci) && ci > 0) ci--
  }
  while (exclude.has(ci) && ci >= 0 && ci < colCount) {
    ci += delta
  }
  return clampCol(ci, colCount)
}

function firstNavigableCol(colCount: number, exclude: Set<number>): number {
  let ci = 0
  while (exclude.has(ci) && ci < colCount - 1) ci++
  return ci
}

function lastNavigableCol(colCount: number, exclude: Set<number>): number {
  let ci = colCount - 1
  while (exclude.has(ci) && ci > 0) ci--
  return ci
}

function initialInteractionState(): GridInteractionState {
  return {
    focusCell: null,
    anchorCell: null,
    selectionRanges: [],
    editingCell: null,
    draftValue: '',
    mode: 'NONE',
    excludeColIndices: new Set(),
  }
}

function reducer(state: GridInteractionState, action: Action): GridInteractionState {
  switch (action.type) {
    case 'MOVE_FOCUS': {
      if (!state.focusCell) {
        const col = firstNavigableCol(action.colCount, state.excludeColIndices)
        const addr = { rowIndex: 0, colIndex: col }
        return { ...initialInteractionState(), focusCell: addr, anchorCell: addr }
      }
      const fc = state.focusCell
      let newCol = fc.colIndex
      let newRow = fc.rowIndex + action.rowDelta
      if (action.colDelta !== 0) {
        newCol = skipExcludedCol(fc.colIndex, action.colDelta > 0 ? 1 : -1, action.colCount, state.excludeColIndices)
      }
      newRow = clampRow(newRow, action.rowCount)
      const newAddr: CellAddress = { rowIndex: newRow, colIndex: newCol }
      return { ...initialInteractionState(), focusCell: newAddr, anchorCell: newAddr }
    }

    case 'JUMP_BOUNDARY': {
      if (!state.focusCell) return state
      const newAddr = jumpBoundary(state.focusCell, action.direction, action.rowCount, action.colCount, action.data, action.getCellValue, state.excludeColIndices)
      return { ...initialInteractionState(), focusCell: newAddr, anchorCell: newAddr }
    }

    case 'JUMP_HOME': {
      if (!state.focusCell) {
        if (action.ctrl) {
          const col = firstNavigableCol(action.colCount, state.excludeColIndices)
          const addr = { rowIndex: 0, colIndex: col }
          return { ...initialInteractionState(), focusCell: addr, anchorCell: addr }
        }
        return state
      }
      const col = action.ctrl
        ? firstNavigableCol(action.colCount, state.excludeColIndices)
        : firstNavigableCol(action.colCount, state.excludeColIndices)
      const row = action.ctrl ? 0 : state.focusCell.rowIndex
      const newAddr = { rowIndex: row, colIndex: col }
      return { ...initialInteractionState(), focusCell: newAddr, anchorCell: newAddr }
    }

    case 'JUMP_END': {
      if (!state.focusCell) return state
      const col = action.ctrl
        ? lastNavigableCol(action.colCount, state.excludeColIndices)
        : lastNavigableCol(action.colCount, state.excludeColIndices)
      const row = action.ctrl ? action.rowCount - 1 : state.focusCell.rowIndex
      const newAddr = { rowIndex: row, colIndex: col }
      return { ...initialInteractionState(), focusCell: newAddr, anchorCell: newAddr }
    }

    case 'PAGE_UP_DOWN': {
      if (!state.focusCell) return state
      const delta = action.direction === 'down' ? action.pageSize : -action.pageSize
      const newAddr = moveAddress(state.focusCell, delta, 0, action.rowCount, action.colCount)
      return { ...initialInteractionState(), focusCell: newAddr, anchorCell: newAddr }
    }

    case 'EXTEND_RANGE': {
      if (!state.focusCell) {
        const col = firstNavigableCol(action.colCount, state.excludeColIndices)
        const addr = { rowIndex: 0, colIndex: col }
        return { focusCell: addr, anchorCell: addr, selectionRanges: [{ start: addr, end: addr }], editingCell: null, draftValue: '', mode: 'CELL_RANGE', excludeColIndices: state.excludeColIndices }
      }
      const anchor = state.anchorCell ?? state.focusCell
      let newCol = state.focusCell.colIndex
      if (action.colDelta !== 0) {
        const dir = action.colDelta > 0 ? 1 : -1
        newCol = skipExcludedCol(state.focusCell.colIndex, dir, action.colCount, state.excludeColIndices)
      }
      let newRow = state.focusCell.rowIndex + action.rowDelta
      newRow = clampRow(newRow, action.rowCount)
      const newFocus: CellAddress = { rowIndex: newRow, colIndex: newCol }
      const range: CellRange = { start: anchor, end: newFocus }
      return { ...state, focusCell: newFocus, selectionRanges: [range], mode: 'CELL_RANGE' }
    }

    case 'EXTEND_BOUNDARY': {
      if (!state.focusCell) return state
      const anchor = state.anchorCell ?? state.focusCell
      const newFocus = jumpBoundary(state.focusCell, action.direction, action.rowCount, action.colCount, action.data, action.getCellValue, state.excludeColIndices)
      const range: CellRange = { start: anchor, end: newFocus }
      return { ...state, focusCell: newFocus, selectionRanges: [range], mode: 'CELL_RANGE' }
    }

    case 'EXTEND_HOME': {
      if (!state.focusCell) return state
      const anchor = state.anchorCell ?? state.focusCell
      const col = action.ctrl
        ? firstNavigableCol(action.colCount, state.excludeColIndices)
        : firstNavigableCol(action.colCount, state.excludeColIndices)
      const row = action.ctrl ? 0 : state.focusCell.rowIndex
      const newFocus = { rowIndex: row, colIndex: col }
      const range: CellRange = { start: anchor, end: newFocus }
      return { ...state, focusCell: newFocus, selectionRanges: [range], mode: 'CELL_RANGE' }
    }

    case 'EXTEND_END': {
      if (!state.focusCell) return state
      const anchor = state.anchorCell ?? state.focusCell
      const col = action.ctrl
        ? lastNavigableCol(action.colCount, state.excludeColIndices)
        : lastNavigableCol(action.colCount, state.excludeColIndices)
      const row = action.ctrl ? action.rowCount - 1 : state.focusCell.rowIndex
      const newFocus = { rowIndex: row, colIndex: col }
      const range: CellRange = { start: anchor, end: newFocus }
      return { ...state, focusCell: newFocus, selectionRanges: [range], mode: 'CELL_RANGE' }
    }

    case 'EXTEND_PAGE_UP_DOWN': {
      if (!state.focusCell) return state
      const anchor = state.anchorCell ?? state.focusCell
      const delta = action.direction === 'down' ? action.pageSize : -action.pageSize
      const newFocus = moveAddress(state.focusCell, delta, 0, action.rowCount, action.colCount)
      const range: CellRange = { start: anchor, end: newFocus }
      return { ...state, focusCell: newFocus, selectionRanges: [range], mode: 'CELL_RANGE' }
    }

    case 'SET_FOCUS': {
      return { ...initialInteractionState(), focusCell: action.address, anchorCell: action.address }
    }

    case 'SET_ANCHOR': {
      return { ...state, anchorCell: action.address }
    }

    case 'START_DRAG': {
      return {
        ...initialInteractionState(),
        focusCell: action.address,
        anchorCell: action.address,
        selectionRanges: [{ start: action.address, end: action.address }],
        mode: 'CELL_RANGE',
      }
    }

    case 'UPDATE_DRAG': {
      if (!state.anchorCell) return state
      const range: CellRange = { start: state.anchorCell, end: action.address }
      return { ...state, focusCell: action.address, selectionRanges: [range], mode: 'CELL_RANGE' }
    }

    case 'END_DRAG': {
      return state
    }

    case 'ADD_RANGE': {
      const existing = state.selectionRanges.some((r) => isInRange(action.address, r))
      if (existing && state.focusCell && cellAddressEqual(action.address, state.focusCell)) {
        const filtered = state.selectionRanges.filter((r) => !isInRange(action.address, r))
        if (filtered.length === 0) {
          return { ...initialInteractionState(), focusCell: action.address, anchorCell: action.address, excludeColIndices: state.excludeColIndices }
        }
        return { ...state, selectionRanges: filtered, mode: filtered.length > 1 ? 'MULTI_RANGE' : 'CELL_RANGE' }
      }
      const newRanges = [...state.selectionRanges, { start: action.address, end: action.address }]
      return { ...state, focusCell: action.address, anchorCell: action.address, selectionRanges: newRanges, mode: 'MULTI_RANGE' }
    }

    case 'SELECT_ALL': {
      if (state.mode === 'CELL_RANGE' && state.selectionRanges.length > 0) {
        const first = state.selectionRanges[0]!
        const n = rangeNormalize(first)
        const fc = firstNavigableCol(action.colCount, state.excludeColIndices)
        const lc = lastNavigableCol(action.colCount, state.excludeColIndices)
        if (n.start.rowIndex === 0 && n.start.colIndex === fc &&
            n.end.rowIndex === action.pageRowCount - 1 && n.end.colIndex === lc) {
          if (action.fullDataset && action.totalRowCount) {
            const allRange: CellRange = { start: { rowIndex: 0, colIndex: fc }, end: { rowIndex: action.totalRowCount - 1, colIndex: lc } }
            return { ...state, selectionRanges: [allRange], mode: 'CELL_RANGE' }
          }
          return { ...initialInteractionState() }
        }
      }
      const fc = firstNavigableCol(action.colCount, state.excludeColIndices)
      const lc = lastNavigableCol(action.colCount, state.excludeColIndices)
      const allRange: CellRange = { start: { rowIndex: 0, colIndex: fc }, end: { rowIndex: action.pageRowCount - 1, colIndex: lc } }
      return { ...state, selectionRanges: [allRange], focusCell: { rowIndex: 0, colIndex: fc }, anchorCell: { rowIndex: 0, colIndex: fc }, mode: 'CELL_RANGE' }
    }

    case 'CLEAR_SELECTION': {
      return { ...state, selectionRanges: [], mode: 'NONE' }
    }

    case 'START_EDIT': {
      return { ...state, editingCell: action.address, draftValue: action.value }
    }

    case 'SET_DRAFT': {
      return { ...state, draftValue: action.value }
    }

    case 'COMMIT_EDIT': {
      return { ...state, editingCell: null, draftValue: '' }
    }

    case 'DISCARD_EDIT': {
      return { ...state, editingCell: null, draftValue: '' }
    }

    case 'TAB_NEXT': {
      if (!state.focusCell) return state
      let newCol = state.focusCell.colIndex + 1
      let newRow = state.focusCell.rowIndex
      const lc = lastNavigableCol(action.colCount, state.excludeColIndices)
      const fc = firstNavigableCol(action.colCount, state.excludeColIndices)
      if (newCol > lc) {
        newCol = fc
        newRow++
      }
      while (state.excludeColIndices.has(newCol) && newCol <= lc) {
        newCol++
      }
      if (newCol > lc) {
        newCol = fc
        newRow++
      }
      if (newRow >= action.rowCount) return state
      const addr = { rowIndex: newRow, colIndex: newCol }
      return { ...initialInteractionState(), focusCell: addr, anchorCell: addr }
    }

    case 'TAB_PREV': {
      if (!state.focusCell) return state
      let newCol = state.focusCell.colIndex - 1
      let newRow = state.focusCell.rowIndex
      const fc = firstNavigableCol(action.colCount, state.excludeColIndices)
      const lc = lastNavigableCol(action.colCount, state.excludeColIndices)
      if (newCol < fc) {
        newCol = lc
        newRow--
      }
      while (state.excludeColIndices.has(newCol) && newCol >= fc) {
        newCol--
      }
      if (newCol < fc) {
        newCol = lc
        newRow--
      }
      if (newRow < 0) return state
      const addr = { rowIndex: newRow, colIndex: newCol }
      return { ...initialInteractionState(), focusCell: addr, anchorCell: addr }
    }

    case 'ENTER_NEXT': {
      if (!state.focusCell) return state
      const newRow = state.focusCell.rowIndex + 1
      if (newRow >= action.rowCount) return state
      const addr = { rowIndex: newRow, colIndex: state.focusCell.colIndex }
      return { ...initialInteractionState(), focusCell: addr, anchorCell: addr }
    }

    case 'ENTER_PREV': {
      if (!state.focusCell) return state
      const newRow = state.focusCell.rowIndex - 1
      if (newRow < 0) return state
      const addr = { rowIndex: newRow, colIndex: state.focusCell.colIndex }
      return { ...initialInteractionState(), focusCell: addr, anchorCell: addr }
    }

    case 'SET_MODE_ROW': {
      return { ...initialInteractionState(), mode: 'ROW' }
    }

    case 'CLEAR_ROW_SELECTION': {
      return { ...state, mode: state.mode === 'ROW' ? 'NONE' : state.mode }
    }

    case 'SHIFT_CLICK_RANGE': {
      const range: CellRange = { start: action.anchor, end: action.clickAddress }
      return {
        ...state,
        focusCell: action.clickAddress,
        anchorCell: action.anchor,
        selectionRanges: [range],
        mode: 'CELL_RANGE',
      }
    }

    default:
      return state
  }
}

export interface GridInteractionConfig {
  rowCount: number
  colCount: number
  pageSize: number
  data: unknown[]
  editableColumns: Set<number>
  excludeColIndices?: Set<number>
  getCellValue: (rowIndex: number, colIndex: number) => string
  onCellEdit: (rowIndex: number, colIndex: number, value: string) => void
  onBatchEdit?: (updates: { rowIndex: number; colIndex: number; value: string }[]) => void
  onCopyRequest: (ranges: CellRange[]) => string[][]
  scrollToRow: (rowIndex: number) => void
  scrollToCol: (colIndex: number) => void
  fullDataset?: boolean
  totalRowCount?: number
  onF2NonEditable?: (address: CellAddress) => void
  validateCell?: (rowIndex: number, colIndex: number, value: string) => string | null
  onValidationError?: (address: CellAddress, message: string) => void
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>
}

export function useGridInteraction(config: GridInteractionConfig) {
  const [state, dispatch] = useReducer(
    (s: GridInteractionState, a: Action) => reducer(s, a),
    undefined,
    () => ({ ...initialInteractionState(), excludeColIndices: config.excludeColIndices ?? new Set() }),
  )
  const dragRef = useRef(false)
  const autoScrollRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null)
  const configRef = useRef(config)
  const mousePosRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    configRef.current = config
  }, [config])

  useEffect(() => {
    if (!state.focusCell) return
    configRef.current.scrollToRow(state.focusCell.rowIndex)
    configRef.current.scrollToCol(state.focusCell.colIndex)
  }, [state.focusCell, config])

  const doAutoScrollRef = useRef<() => void>(undefined)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    doAutoScrollRef.current = () => {
      if (!dragRef.current) return
      const el = scrollContainerRef.current ?? configRef.current.scrollContainerRef?.current ?? null
      if (!el || !mousePosRef.current) return
      const rect = el.getBoundingClientRect()
      const { x, y } = mousePosRef.current
      const threshold = 40
      const maxStep = 8
      let dx = 0
      let dy = 0
      if (x < rect.left + threshold) {
        dx = -Math.max(1, Math.round((rect.left + threshold - x) / threshold * maxStep))
      } else if (x > rect.right - threshold) {
        dx = Math.max(1, Math.round((x - (rect.right - threshold)) / threshold * maxStep))
      }
      if (y < rect.top + threshold) {
        dy = -Math.max(1, Math.round((rect.top + threshold - y) / threshold * maxStep))
      } else if (y > rect.bottom - threshold) {
        dy = Math.max(1, Math.round((y - (rect.bottom - threshold)) / threshold * maxStep))
      }
      if (dx !== 0 || dy !== 0) {
        el.scrollLeft = el.scrollLeft + dx
        el.scrollTop = el.scrollTop + dy
      }
      autoScrollRef.current = requestAnimationFrame(doAutoScrollRef.current!)
    }
  }, [])

  useEffect(() => {
    scrollContainerRef.current = configRef.current.scrollContainerRef?.current ?? null
  })

  const startAutoScroll = useCallback(() => {
    if (autoScrollRef.current) cancelAnimationFrame(autoScrollRef.current)
    autoScrollRef.current = requestAnimationFrame(doAutoScrollRef.current!)
  }, [])

  const stopAutoScroll = useCallback(() => {
    if (autoScrollRef.current) {
      cancelAnimationFrame(autoScrollRef.current)
      autoScrollRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!dragRef.current) {
      stopAutoScroll()
      return
    }
    startAutoScroll()
    return () => stopAutoScroll()
  })

  useEffect(() => {
    return () => {
      stopAutoScroll()
    }
  }, [stopAutoScroll])

  const isCellSelected = useCallback((addr: CellAddress): boolean => {
    return state.selectionRanges.some((r) => isInRange(addr, r))
  }, [state.selectionRanges])

  const isCellFocused = useCallback((addr: CellAddress): boolean => {
    return !!state.focusCell && cellAddressEqual(addr, state.focusCell)
  }, [state.focusCell])

  const isCellEditing = useCallback((addr: CellAddress): boolean => {
    return !!state.editingCell && cellAddressEqual(addr, state.editingCell)
  }, [state.editingCell])

  const commitEdit = useCallback((newValue?: string) => {
    if (!state.editingCell || !state.focusCell) return
    const value = newValue ?? state.draftValue
    const cell = state.editingCell
    if (configRef.current.validateCell) {
      const error = configRef.current.validateCell(cell.rowIndex, cell.colIndex, value)
      if (error) {
        configRef.current.onValidationError?.(cell, error)
        return
      }
    }
    if (configRef.current.editableColumns.has(cell.colIndex) && value !== undefined) {
      configRef.current.onCellEdit(cell.rowIndex, cell.colIndex, value)
    }
    dispatch({ type: 'COMMIT_EDIT' })
    configRef.current.scrollToRow(cell.rowIndex)
  }, [state.editingCell, state.draftValue])

  const isEditing = state.editingCell !== null

  const onContainerKeyDown = useCallback((e: React.KeyboardEvent) => {
    const c = configRef.current
    const key = e.key
    const isCtrl = e.ctrlKey || e.metaKey
    const isShift = e.shiftKey

    if (isEditing) {
      if (key === 'Escape') {
        e.preventDefault()
        dispatch({ type: 'DISCARD_EDIT' })
        return
      }
      if (key === 'Enter') {
        e.preventDefault()
        commitEdit()
        if (state.focusCell) {
          dispatch({ type: 'ENTER_NEXT', rowCount: c.rowCount, colCount: c.colCount })
        }
        return
      }
      if (key === 'Tab') {
        e.preventDefault()
        commitEdit()
        if (state.focusCell) {
          if (isShift) {
            dispatch({ type: 'TAB_PREV', rowCount: c.rowCount, colCount: c.colCount })
          } else {
            dispatch({ type: 'TAB_NEXT', rowCount: c.rowCount, colCount: c.colCount })
          }
        }
        return
      }
      return
    }

    if (isCtrl && key === 'a') {
      e.preventDefault()
      dispatch({ type: 'SELECT_ALL', pageRowCount: c.rowCount, colCount: c.colCount, fullDataset: c.fullDataset ?? false, totalRowCount: c.totalRowCount })
      return
    }

    if (isCtrl && key === 'c') {
      e.preventDefault()
      if (state.selectionRanges.length > 0) {
        const values = c.onCopyRequest(state.selectionRanges)
        const plain = values.map((row) => row.join('\t')).join('\n')
        const html = `<table>${values.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}</table>`
        navigator.clipboard.write([
          new ClipboardItem({
            'text/plain': new Blob([plain], { type: 'text/plain' }),
            'text/html': new Blob([html], { type: 'text/html' }),
          }),
        ]).catch(() => {
          navigator.clipboard.writeText(plain).catch(() => {})
        })
      }
      return
    }

    if (isCtrl && key === 'x') {
      e.preventDefault()
      if (state.selectionRanges.length > 0) {
        const values = c.onCopyRequest(state.selectionRanges)
        const plain = values.map((row) => row.join('\t')).join('\n')
        const html = `<table>${values.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}</table>`
        navigator.clipboard.write([
          new ClipboardItem({
            'text/plain': new Blob([plain], { type: 'text/plain' }),
            'text/html': new Blob([html], { type: 'text/html' }),
          }),
        ]).catch(() => {
          navigator.clipboard.writeText(plain).catch(() => {})
        })
        const deletedCells: { rowIndex: number; colIndex: number }[] = []
        for (const range of state.selectionRanges) {
          const n = rangeNormalize(range)
          for (let r = n.start.rowIndex; r <= n.end.rowIndex; r++) {
            for (let col = n.start.colIndex; col <= n.end.colIndex; col++) {
              if (c.editableColumns.has(col)) {
                deletedCells.push({ rowIndex: r, colIndex: col })
              }
            }
          }
        }
        // Spec §8.2: Use batch API if available, otherwise fall back to individual calls
        if (c.onBatchEdit && deletedCells.length > 0) {
          c.onBatchEdit(deletedCells.map((cell) => ({ rowIndex: cell.rowIndex, colIndex: cell.colIndex, value: '' })))
        } else {
          for (const cell of deletedCells) {
            c.onCellEdit(cell.rowIndex, cell.colIndex, '')
          }
        }
      }
      return
    }

    if (isCtrl && key === 'v') {
      e.preventDefault()
      if (!state.focusCell) return
      navigator.clipboard.readText().then((text) => {
        if (!text) return
        const rows = text.split('\n').filter((r) => r.length > 0)
        const updates: { rowIndex: number; colIndex: number; value: string }[] = []
        let skippedBatch = 0
        for (let ri = 0; ri < rows.length; ri++) {
          const cols = rows[ri]!.split('\t')
          for (let ci = 0; ci < cols.length; ci++) {
            const targetRow = state.focusCell!.rowIndex + ri
            const targetCol = state.focusCell!.colIndex + ci
            if (targetRow >= c.rowCount || targetCol >= c.colCount) break
            if (c.editableColumns.has(targetCol)) {
              updates.push({ rowIndex: targetRow, colIndex: targetCol, value: cols[ci]! })
            } else {
              skippedBatch++
            }
          }
        }
        // Spec §8.3: Use batch API if available
        if (c.onBatchEdit && updates.length > 0) {
          c.onBatchEdit(updates)
        } else {
          for (const u of updates) {
            c.onCellEdit(u.rowIndex, u.colIndex, u.value)
          }
        }
        if (skippedBatch > 0) {
          toast.info(`Skipped ${skippedBatch} non-editable cell(s)`)
        }
      }).catch(() => {})
      return
    }

    if (isCtrl && key === 'd') {
      e.preventDefault()
      if (state.selectionRanges.length === 0 || !state.focusCell) return
      const n = rangeNormalize(state.selectionRanges[0]!)
      const updates: { rowIndex: number; colIndex: number; value: string }[] = []
      for (let ri = n.start.rowIndex + 1; ri <= n.end.rowIndex; ri++) {
        for (let ci = n.start.colIndex; ci <= n.end.colIndex; ci++) {
          if (c.editableColumns.has(ci)) {
            const topVal = c.getCellValue(n.start.rowIndex, ci)
            updates.push({ rowIndex: ri, colIndex: ci, value: topVal })
          }
        }
      }
      // Spec §8.4: Use batch API if available
      if (c.onBatchEdit && updates.length > 0) {
        c.onBatchEdit(updates)
      } else {
        for (const u of updates) {
          c.onCellEdit(u.rowIndex, u.colIndex, u.value)
        }
      }
      return
    }

    if (isCtrl && key === 'r') {
      e.preventDefault()
      if (state.selectionRanges.length === 0 || !state.focusCell) return
      const n = rangeNormalize(state.selectionRanges[0]!)
      const updates: { rowIndex: number; colIndex: number; value: string }[] = []
      for (let ri = n.start.rowIndex; ri <= n.end.rowIndex; ri++) {
        for (let ci = n.start.colIndex + 1; ci <= n.end.colIndex; ci++) {
          if (c.editableColumns.has(ci)) {
            const leftVal = c.getCellValue(ri, n.start.colIndex)
            updates.push({ rowIndex: ri, colIndex: ci, value: leftVal })
          }
        }
      }
      // Spec §8.5: Use batch API if available
      if (c.onBatchEdit && updates.length > 0) {
        c.onBatchEdit(updates)
      } else {
        for (const u of updates) {
          c.onCellEdit(u.rowIndex, u.colIndex, u.value)
        }
      }
      return
    }

    if (isCtrl) {
      const dirMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
        ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      }
      const dir = dirMap[key]
        if (dir) {
        e.preventDefault()
        if (isShift) {
          dispatch({ type: 'EXTEND_BOUNDARY', direction: dir, rowCount: c.rowCount, colCount: c.colCount, data: c.data, getCellValue: c.getCellValue, excludeColIndices: c.excludeColIndices })
        } else {
          dispatch({ type: 'JUMP_BOUNDARY', direction: dir, rowCount: c.rowCount, colCount: c.colCount, data: c.data, getCellValue: c.getCellValue, excludeColIndices: c.excludeColIndices })
        }
        return
      }
    }

    if (isShift) {
      const shiftMap: Record<string, { rowDelta: number; colDelta: number }> = {
        ArrowUp: { rowDelta: -1, colDelta: 0 },
        ArrowDown: { rowDelta: 1, colDelta: 0 },
        ArrowLeft: { rowDelta: 0, colDelta: -1 },
        ArrowRight: { rowDelta: 0, colDelta: 1 },
      }
      const sMove = shiftMap[key]
      if (sMove) {
        e.preventDefault()
        dispatch({ type: 'EXTEND_RANGE', ...sMove, rowCount: c.rowCount, colCount: c.colCount, data: c.data, getCellValue: c.getCellValue })
        return
      }
      if (key === 'Home') {
        e.preventDefault()
        dispatch({ type: 'EXTEND_HOME', ctrl: isCtrl, rowCount: c.rowCount, colCount: c.colCount })
        return
      }
      if (key === 'End') {
        e.preventDefault()
        dispatch({ type: 'EXTEND_END', ctrl: isCtrl, rowCount: c.rowCount, colCount: c.colCount })
        return
      }
      if (key === 'PageUp') {
        e.preventDefault()
        dispatch({ type: 'EXTEND_PAGE_UP_DOWN', direction: 'up', pageSize: c.pageSize, rowCount: c.rowCount, colCount: c.colCount })
        return
      }
      if (key === 'PageDown') {
        e.preventDefault()
        dispatch({ type: 'EXTEND_PAGE_UP_DOWN', direction: 'down', pageSize: c.pageSize, rowCount: c.rowCount, colCount: c.colCount })
        return
      }
    }

    const dirMap: Record<string, { rowDelta: number; colDelta: number }> = {
      ArrowUp: { rowDelta: -1, colDelta: 0 },
      ArrowDown: { rowDelta: 1, colDelta: 0 },
      ArrowLeft: { rowDelta: 0, colDelta: -1 },
      ArrowRight: { rowDelta: 0, colDelta: 1 },
    }
    const move = dirMap[key]
    if (move) {
      e.preventDefault()
      dispatch({ type: 'MOVE_FOCUS', ...move, rowCount: c.rowCount, colCount: c.colCount, data: c.data, getCellValue: c.getCellValue })
      return
    }

    if (key === 'Tab') {
      const fc = firstNavigableCol(c.colCount, c.excludeColIndices ?? new Set())
      const lc = lastNavigableCol(c.colCount, c.excludeColIndices ?? new Set())
      const atFirstCell = state.focusCell && state.focusCell.colIndex <= fc && state.focusCell.rowIndex === 0
      const atLastCell = state.focusCell && state.focusCell.colIndex >= lc && state.focusCell.rowIndex >= c.rowCount - 1
      if (isShift ? atFirstCell : atLastCell) {
        return
      }
      e.preventDefault()
      if (isShift) {
        dispatch({ type: 'TAB_PREV', rowCount: c.rowCount, colCount: c.colCount })
      } else {
        dispatch({ type: 'TAB_NEXT', rowCount: c.rowCount, colCount: c.colCount })
      }
      return
    }

    if (key === 'Enter') {
      e.preventDefault()
      if (isShift) {
        dispatch({ type: 'ENTER_PREV', rowCount: c.rowCount, colCount: c.colCount })
      } else {
        dispatch({ type: 'ENTER_NEXT', rowCount: c.rowCount, colCount: c.colCount })
      }
      return
    }

    if (key === 'Home') {
      e.preventDefault()
      dispatch({ type: 'JUMP_HOME', ctrl: isCtrl, rowCount: c.rowCount, colCount: c.colCount })
      return
    }

    if (key === 'End') {
      e.preventDefault()
      dispatch({ type: 'JUMP_END', ctrl: isCtrl, rowCount: c.rowCount, colCount: c.colCount })
      return
    }

    if (key === 'PageUp') {
      if (isCtrl) return
      e.preventDefault()
      dispatch({ type: 'PAGE_UP_DOWN', direction: 'up', pageSize: c.pageSize, rowCount: c.rowCount, colCount: c.colCount })
      return
    }

    if (key === 'PageDown') {
      if (isCtrl) return
      e.preventDefault()
      dispatch({ type: 'PAGE_UP_DOWN', direction: 'down', pageSize: c.pageSize, rowCount: c.rowCount, colCount: c.colCount })
      return
    }

    if (key === 'Escape' && state.mode !== 'NONE') {
      e.preventDefault()
      dispatch({ type: 'CLEAR_SELECTION' })
      return
    }

    if ((key === 'Delete' || key === 'Backspace') && !isEditing && state.selectionRanges.length > 0) {
      e.preventDefault()
      const deletedCells: { rowIndex: number; colIndex: number }[] = []
      for (const range of state.selectionRanges) {
        const n = rangeNormalize(range)
        for (let r = n.start.rowIndex; r <= n.end.rowIndex; r++) {
          for (let col = n.start.colIndex; col <= n.end.colIndex; col++) {
            if (c.editableColumns.has(col)) {
              deletedCells.push({ rowIndex: r, colIndex: col })
            }
          }
        }
      }
      for (const cell of deletedCells) {
        c.onCellEdit(cell.rowIndex, cell.colIndex, '')
      }
      return
    }

    if (key === 'F2' && state.focusCell) {
      e.preventDefault()
      if (c.editableColumns.has(state.focusCell.colIndex)) {
        const curVal = c.getCellValue(state.focusCell.rowIndex, state.focusCell.colIndex)
        const val = curVal === '—' ? '' : curVal
        dispatch({ type: 'START_EDIT', address: state.focusCell, value: val })
      } else {
        c.onF2NonEditable?.(state.focusCell)
      }
      return
    }

    if (key.length === 1 && state.focusCell && c.editableColumns.has(state.focusCell.colIndex)) {
      e.preventDefault()
      dispatch({ type: 'START_EDIT', address: state.focusCell, value: '' })
      return
    }

    // Spec §14.6: Ctrl+/ or ? opens keyboard shortcut help panel
    if (key === '/' && isCtrl) {
      e.preventDefault()
      toast.info('Keyboard shortcut help: coming soon')
      return
    }
  }, [isEditing, commitEdit])

  const onCellMouseDown = useCallback((address: CellAddress, e: React.MouseEvent) => {
    // Spec §6.3: Click another cell while in edit mode commits the edit
    if (state.editingCell && !cellAddressEqual(address, state.editingCell)) {
      commitEdit()
    }
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      dispatch({ type: 'ADD_RANGE', address })
      return
    }
    if (e.shiftKey && state.focusCell) {
      e.preventDefault()
      const anchor = state.anchorCell ?? state.focusCell
      dispatch({ type: 'SHIFT_CLICK_RANGE', anchor, clickAddress: address })
      return
    }
    if (state.focusCell && cellAddressEqual(address, state.focusCell)) {
      return
    }
    dragRef.current = true
    const handleMouseMove = (ev: MouseEvent) => {
      mousePosRef.current = { x: ev.clientX, y: ev.clientY }
    }
    document.addEventListener('mousemove', handleMouseMove)
    const handleMouseUpDoc = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUpDoc)
      mousePosRef.current = null
    }
    document.addEventListener('mouseup', handleMouseUpDoc)
    dispatch({ type: 'START_DRAG', address })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onCellMouseEnter = useCallback((address: CellAddress) => {
    if (!dragRef.current) return
    dispatch({ type: 'UPDATE_DRAG', address })
  }, [])

  const onCellMouseUp = useCallback(() => {
    if (!dragRef.current) return
    dragRef.current = false
    dispatch({ type: 'END_DRAG' })
  }, [])

  const onCellDoubleClick = useCallback((address: CellAddress) => {
    if (configRef.current.editableColumns.has(address.colIndex)) {
      const curVal = configRef.current.getCellValue(address.rowIndex, address.colIndex)
      const val = curVal === '—' ? '' : curVal
      dispatch({ type: 'START_EDIT', address, value: val })
    } else {
      configRef.current.onF2NonEditable?.(address)
    }
  }, [])

  return {
    state,
    dispatch,
    isCellSelected,
    isCellFocused,
    isCellEditing,
    commitEdit,
    onContainerKeyDown,
    onCellMouseDown,
    onCellMouseEnter,
    onCellMouseUp,
    onCellDoubleClick,
  }
}
