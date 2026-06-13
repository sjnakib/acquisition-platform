'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export const usePortfolios = (projectId?: string) => {
  const supabase = createClient()
  return useQuery({
    queryKey: ['portfolios', projectId],
    queryFn: async () => {
      let query = supabase
        .from('portfolios')
        .select('*, deals!deals_portfolio_id_fkey(id), portfolio_deal_id')
        .order('created_at', { ascending: false })
      if (projectId) query = query.eq('project_id', projectId)
      const { data, error } = await query
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
        .select('*, deals!deals_portfolio_id_fkey(*, deal_fields(value, field_definitions(key, label, data_type)))')
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
    mutationFn: async (body: { name: string; description?: string; project_id?: string }) => {
      const res = await fetch('/api/portfolios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] })
      // Also invalidate deals queries since portfolio creation creates a linked deal
      queryClient.invalidateQueries({ queryKey: ['deals'] })
    },
  })
}

export const useUpdatePortfolio = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; name?: string; description?: string }) => {
      const res = await fetch(`/api/portfolios/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] })
      queryClient.invalidateQueries({ queryKey: ['deals'] })
    },
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] })
      queryClient.invalidateQueries({ queryKey: ['deals'] })
    },
  })
}
