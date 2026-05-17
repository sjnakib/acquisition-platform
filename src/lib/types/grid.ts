export type CellAddress = {
  rowIndex: number
  colIndex: number
}

export type CellRange = {
  start: CellAddress
  end: CellAddress
}

export type GridInteractionMode = 'NONE' | 'CELL_RANGE' | 'MULTI_RANGE' | 'ROW'

export type GridInteractionState = {
  focusCell: CellAddress | null
  anchorCell: CellAddress | null
  selectionRanges: CellRange[]
  editingCell: CellAddress | null
  draftValue: string
  mode: GridInteractionMode
  excludeColIndices: Set<number>
}

export function rangeNormalize(r: CellRange): CellRange {
  return {
    start: {
      rowIndex: Math.min(r.start.rowIndex, r.end.rowIndex),
      colIndex: Math.min(r.start.colIndex, r.end.colIndex),
    },
    end: {
      rowIndex: Math.max(r.start.rowIndex, r.end.rowIndex),
      colIndex: Math.max(r.start.colIndex, r.end.colIndex),
    },
  }
}

export function isInRange(addr: CellAddress, range: CellRange): boolean {
  const n = rangeNormalize(range)
  return (
    addr.rowIndex >= n.start.rowIndex && addr.rowIndex <= n.end.rowIndex &&
    addr.colIndex >= n.start.colIndex && addr.colIndex <= n.end.colIndex
  )
}

export function isInAnyRange(addr: CellAddress, ranges: CellRange[]): boolean {
  return ranges.some((r) => isInRange(addr, r))
}

export function rangesEqual(a: CellRange, b: CellRange): boolean {
  return a.start.rowIndex === b.start.rowIndex && a.start.colIndex === b.start.colIndex &&
    a.end.rowIndex === b.end.rowIndex && a.end.colIndex === b.end.colIndex
}

export function cellAddressEqual(a: CellAddress, b: CellAddress): boolean {
  return a.rowIndex === b.rowIndex && a.colIndex === b.colIndex
}
