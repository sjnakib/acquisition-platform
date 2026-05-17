'use client'

import { useRef, useCallback, useEffect, useState } from 'react'
import { useDebouncedCallback } from 'use-debounce'

const STORAGE_KEY = 'dealTableColumnWidths'
const MIN_COL_WIDTH = 60
const MAX_COL_WIDTH = 600

export function useColumnWidths() {
  const [widths, setWidths] = useState<Record<string, number>>({})

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setTimeout(() => {
          setWidths(JSON.parse(stored) as Record<string, number>)
        }, 0)
      }
    } catch {}
  }, [])

  const persist = useDebouncedCallback(
    (next: Record<string, number>) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {}
    },
    500,
  )

  const setWidth = useCallback((colKey: string, w: number) => {
    const clamped = Math.max(MIN_COL_WIDTH, Math.min(MAX_COL_WIDTH, w))
    setWidths((prev) => {
      const next = { ...prev, [colKey]: clamped }
      persist(next)
      return next
    })
  }, [persist])

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const measureCacheRef = useRef<Map<string, number>>(new Map())

  const measureText = useCallback((text: string, font: string): number => {
    const cacheKey = `${font}:${text}`
    const cached = measureCacheRef.current.get(cacheKey)
    if (cached !== undefined) return cached
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas')
    }
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return 80
    ctx.font = font
    const w = ctx.measureText(text).width
    measureCacheRef.current.set(cacheKey, w)
    return w
  }, [])

  const autoFitColumn = useCallback((
    colKey: string,
    getValues: () => string[],
    font: string = '13px DM Sans',
  ): number => {
    const values = getValues()
    let maxW = 0
    for (const v of values) {
      const mw = measureText(v, font)
      if (mw > maxW) maxW = mw
    }
    const newWidth = Math.max(MIN_COL_WIDTH, Math.min(MAX_COL_WIDTH, maxW + 32))
    setWidth(colKey, newWidth)
    return newWidth
  }, [measureText, setWidth])

  const autoFitSelected = useCallback((
    colKeys: string[],
    getValues: (key: string) => string[],
    font?: string,
  ): Record<string, number> => {
    const results: Record<string, number> = {}
    for (const key of colKeys) {
      results[key] = autoFitColumn(key, () => getValues(key), font)
    }
    return results
  }, [autoFitColumn])

  const invalidateMeasureCache = useCallback(() => {
    measureCacheRef.current.clear()
  }, [])

  const widthsRef = useRef(widths)

  useEffect(() => {
    widthsRef.current = widths
  }, [widths])

  useEffect(() => {
    return () => {
      persist.flush()
    }
  }, [persist])

  return { widths, setWidth, autoFitColumn, autoFitSelected, invalidateMeasureCache }
}
