'use client'

import { useState, useEffect } from 'react'

export function useCallQueue() {
  const [calls, setCalls] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/calls')
      .then((r) => r.json())
      .then((data) => setCalls(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return { calls, loading, error }
}
