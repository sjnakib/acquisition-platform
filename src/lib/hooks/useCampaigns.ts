'use client'

import { useState, useEffect } from 'react'

export function useCampaigns() {
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/campaigns')
      .then((r) => r.json())
      .then((data) => setCampaigns(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return { campaigns, loading, error }
}
