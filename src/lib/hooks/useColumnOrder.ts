'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import type { ColumnDef } from '@/components/shared/DataGrid'

const STORAGE_PREFIX = 'dataGridColumnOrder:'

function getStorageKey(key: string) {
  return `${STORAGE_PREFIX}${key}`
}

/** Stable fingerprint of the default column key set — used to detect when
 *  column definitions change (new fields added/removed) and invalidate
 *  the persisted user order so the code-defined default order takes over. */
function columnFingerprint(columns: ColumnDef<unknown>[]): string {
  return columns
    .map((c) => c.key)
    .filter((k) => k !== 'actions')
    .sort()
    .join(',')
}

function mergeOrder(storedKeys: string[], currentColumns: ColumnDef<unknown>[]): ColumnDef<unknown>[] {
  const ordered: ColumnDef<unknown>[] = []

  // New columns NOT in stored order go first (typically imported dynamic fields
  // that should appear left of the fixed system columns per DealTable definition)
  for (const col of currentColumns) {
    if (col.key === 'actions') continue
    if (!storedKeys.includes(col.key)) {
      ordered.push(col)
    }
  }

  // Then columns in stored order (preserving user's drag-and-drop customization)
  for (const key of storedKeys) {
    if (key === 'actions') continue
    const col = currentColumns.find((c) => c.key === key)
    if (col) ordered.push(col)
  }

  const actionsCol = currentColumns.find((c) => c.key === 'actions')
  if (actionsCol) ordered.push(actionsCol)

  return ordered
}

interface StoredOrder {
  fp: string   // column fingerprint at time of save
  keys: string[]
}

export function useColumnOrder<T>(
  storageKey: string | undefined,
  columns: ColumnDef<T>[],
) {
  // Always start null — localStorage is unavailable during SSR.
  // Reading it in the initializer causes hydration mismatch.
  const [userOrder, setUserOrder] = useState<string[] | null>(null)

  const currentFp = useMemo(
    () => columnFingerprint(columns as ColumnDef<unknown>[]),
    [columns],
  )

  // Load stored order after hydration; discard if column set changed
  useEffect(() => {
    if (!storageKey) return
    try {
      const raw = localStorage.getItem(getStorageKey(storageKey))
      if (raw) {
        const stored = JSON.parse(raw) as StoredOrder
        // Only load if fingerprint matches current column set.
        // Legacy plain-array format (no fingerprint) is rejected —
        // the next onReorder call will persist with a fingerprint.
        if (!Array.isArray(stored) && stored.keys && stored.fp === currentFp && stored.keys.length > 0) {
          setUserOrder(stored.keys)
        }
      }
    } catch {}
  }, [storageKey, currentFp])

  const orderedColumns = useMemo(() => {
    if (!userOrder) return columns

    const merged = mergeOrder(userOrder, columns as ColumnDef<unknown>[])
    if (merged.length === columns.length) return merged as ColumnDef<T>[]
    return columns
  }, [userOrder, columns])

  const onReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return
      const cols = [...orderedColumns]
      const [moved] = cols.splice(fromIndex, 1)
      cols.splice(toIndex, 0, moved!)
      const keys = cols.map((c) => c.key)
      setUserOrder(keys)
      if (storageKey) {
        try {
          const payload: StoredOrder = { fp: currentFp, keys }
          localStorage.setItem(getStorageKey(storageKey), JSON.stringify(payload))
        } catch {}
      }
    },
    [orderedColumns, storageKey, currentFp],
  )

  return { orderedColumns, onReorder }
}
