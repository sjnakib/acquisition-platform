'use client'

import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'acq_sidebar_collapsed'

export function useSidebarCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'true') {
        setTimeout(() => setCollapsed(true), 0)
      }
    } catch { /* noop */ }
  }, [])

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(STORAGE_KEY, String(next))
      } catch { /* noop */ }
      return next
    })
  }, [])

  return [collapsed, toggleCollapsed]
}
