'use client'

import { useQuery } from '@tanstack/react-query'

export function useDeal<T = unknown>(dealId: string) {
  return useQuery<T>({
    queryKey: ['deal', dealId],
    queryFn: async () => {
      const res = await fetch(`/api/deals/${dealId}`)
      if (!res.ok) throw new Error('Failed to fetch deal')
      return res.json()
    },
    enabled: !!dealId,
  })
}
