'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import type { ColumnDef } from '@/components/shared/DataGrid'

const STORAGE_PREFIX = 'dataGridColumnOrder:'

function getStorageKey(key: string) {
  return `${STORAGE_PREFIX}${key}`
}

function mergeOrder(storedKeys: string[], currentColumns: ColumnDef<unknown>[]): ColumnDef<unknown>[] {
  const ordered: ColumnDef<unknown>[] = []

  for (const key of storedKeys) {
    if (key === 'actions') continue
    const col = currentColumns.find((c) => c.key === key)
    if (col) ordered.push(col)
  }

  for (const col of currentColumns) {
    if (col.key === 'actions') continue
    if (!ordered.some((o) => o.key === col.key)) {
      ordered.push(col)
    }
  }

  const actionsCol = currentColumns.find((c) => c.key === 'actions')
  if (actionsCol) ordered.push(actionsCol)

  return ordered
}

export function useColumnOrder<T>(
  storageKey: string | undefined,
  columns: ColumnDef<T>[],
) {
  // Always start null — localStorage is unavailable during SSR.
  // Reading it in the initializer causes hydration mismatch.
  const [userOrder, setUserOrder] = useState<string[] | null>(null)

  // Load stored order after hydration
  useEffect(() => {
    if (!storageKey) return
    try {
      const stored = localStorage.getItem(getStorageKey(storageKey))
      if (stored) {
        const keys = JSON.parse(stored) as string[]
        if (Array.isArray(keys) && keys.length > 0) {
          setUserOrder(keys)
        }
      }
    } catch {}
  }, [storageKey])

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
          localStorage.setItem(getStorageKey(storageKey), JSON.stringify(keys))
        } catch {}
      }
    },
    [orderedColumns, storageKey],
  )

  return { orderedColumns, onReorder }
}
