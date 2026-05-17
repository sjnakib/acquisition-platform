'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export const usePortfolios = () => {
  const supabase = createClient()
  return useQuery({
    queryKey: ['portfolios'],
    queryFn: async () => {
      const { data, error } = await supabase.from('portfolios').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export const usePortfolio = (id: string) => {
  const supabase = createClient()
  return useQuery({
    queryKey: ['portfolios', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portfolios')
        .select('*, deals(*)')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

export const useCreatePortfolio = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: { name: string; description?: string }) => {
      const res = await fetch('/api/portfolios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['portfolios'] }) },
  })
}

export const useDeletePortfolio = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, mode }: { id: string; mode: 'orphan' | 'archive' }) => {
      const res = await fetch(`/api/portfolios/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['portfolios'] }) },
  })
}
