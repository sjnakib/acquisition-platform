'use client'

import { useState, useEffect } from 'react'

export function useDeals(filters?: Record<string, string>) {
  const [deals, setDeals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(filters)
    fetch(`/api/deals?${params}`)
      .then((r) => r.json())
      .then((data) => setDeals(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [JSON.stringify(filters)])

  return { deals, loading, error }
}
