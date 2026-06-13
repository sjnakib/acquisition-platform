'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Plus, Check, X } from 'lucide-react'
import { toast } from 'sonner'

interface DocItem {
  id: string
  deal_id: string
  doc_name: string
  collected: boolean
  metadata: Record<string, unknown>
  sort_order: number
  updated_at: string
}

export function DocumentChecklist({ dealId }: { dealId: string }) {
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [newDocName, setNewDocName] = useState('')

  const { data: docs = [], isLoading: loading } = useQuery<DocItem[]>({
    queryKey: ['deal', dealId, 'documents'],
    queryFn: async () => {
      const res = await fetch(`/api/deals/${dealId}/documents`)
      if (!res.ok) throw new Error('Failed to load documents')
      const data = await res.json()
      return Array.isArray(data) ? data : []
    },
    enabled: !!dealId,
  })

  const toggleMutation = useMutation({
    mutationFn: async (doc: DocItem) => {
      const res = await fetch(`/api/deals/${dealId}/documents`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc_id: doc.id, collected: !doc.collected }),
      })
      if (!res.ok) throw new Error('Failed to update')
    },
    onMutate: async (doc) => {
      await queryClient.cancelQueries({ queryKey: ['deal', dealId, 'documents'] })
      const prev = queryClient.getQueryData<DocItem[]>(['deal', dealId, 'documents'])
      queryClient.setQueryData<DocItem[]>(['deal', dealId, 'documents'], (old) =>
        (old ?? []).map((d) => d.id === doc.id ? { ...d, collected: !doc.collected } : d)
      )
      return { prev }
    },
    onError: (_err, doc, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['deal', dealId, 'documents'], ctx.prev)
      toast.error('Failed to update document status')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['deal', dealId, 'documents'] })
      queryClient.invalidateQueries({ queryKey: ['deals'] })
    },
  })

  const toggleDoc = useCallback((doc: DocItem) => {
    toggleMutation.mutate(doc)
  }, [toggleMutation])

  const addMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch(`/api/deals/${dealId}/documents`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc_name: name }),
      })
      if (!res.ok) throw new Error('Failed to add document')
      return res.json()
    },
    onSuccess: (_, name) => {
      queryClient.invalidateQueries({ queryKey: ['deal', dealId, 'documents'] })
      toast.success(`Document checklist item "${name}" added`)
    },
    onError: () => toast.error('Failed to add document'),
  })

  const addDoc = useCallback(() => {
    if (!newDocName.trim()) return
    const name = newDocName.trim()
    setNewDocName('')
    setAdding(false)
    addMutation.mutate(name)
  }, [newDocName, addMutation])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner size="sm" />
      </div>
    )
  }

  const collected = docs.filter((d) => d.collected).length
  const total = docs.length
  const completionPercentage = total > 0 ? Math.round((collected / total) * 100) : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[13px] font-semibold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
            Document Checklist
          </h3>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
            {total > 0 ? `${collected} of ${total} collected (${completionPercentage}%)` : 'No documents tracked'}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setAdding(true)}
          className="h-7 text-[11px] px-2.5 gap-1 transition-all border-[var(--color-surface-3)] hover:bg-[var(--color-surface-1)]"
        >
          <Plus size={12} />
          Add Item
        </Button>
      </div>

      {total > 0 && (
        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-2)' }}>
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${completionPercentage}%`,
              background: collected === total ? 'var(--color-success)' : 'var(--color-accent)',
            }}
          />
        </div>
      )}

      {adding && (
        <div 
          className="flex items-center gap-2 p-2 rounded-lg border transition-all duration-200" 
          style={{ borderColor: 'var(--color-surface-2)', background: 'var(--color-surface-1)' }}
        >
          <Input
            value={newDocName}
            onChange={(e) => setNewDocName(e.target.value)}
            placeholder="Document name..."
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') addDoc(); if (e.key === 'Escape') setAdding(false) }}
            className="h-7 text-[12px] bg-[var(--color-surface-0)] border-[var(--color-surface-3)] flex-1 focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]"
          />
          <Button 
            size="sm" 
            onClick={addDoc} 
            disabled={!newDocName.trim()} 
            className="h-7 text-[11px] px-3 bg-[var(--color-accent)] border-none text-[var(--color-text-inverse)] hover:opacity-90 transition-opacity"
          >
            Add
          </Button>
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={() => setAdding(false)} 
            className="h-7 w-7 p-0 flex items-center justify-center hover:bg-[var(--color-surface-2)]"
          >
            <X size={12} style={{ color: 'var(--color-text-secondary)' }} />
          </Button>
        </div>
      )}

      <div className="space-y-1 max-h-[320px] overflow-y-auto pr-1">
        {docs.map((doc) => (
          <button
            key={doc.id}
            onClick={() => toggleDoc(doc)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150 group border border-transparent"
            style={{ 
              background: doc.collected ? 'var(--color-success-bg)' : 'transparent',
            }}
            onMouseEnter={(e) => {
              if (!doc.collected) e.currentTarget.style.background = 'var(--color-surface-1)'
            }}
            onMouseLeave={(e) => {
              if (!doc.collected) e.currentTarget.style.background = 'transparent'
            }}
          >
            <div
              className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all duration-150"
              style={{
                background: doc.collected ? 'var(--color-success)' : 'transparent',
                borderColor: doc.collected ? 'var(--color-success)' : 'var(--color-surface-3)',
              }}
            >
              {doc.collected && <Check size={11} style={{ color: 'var(--color-text-inverse)' }} />}
            </div>
            <span
              className={`text-[12px] flex-1 font-medium transition-all duration-150 ${
                doc.collected ? 'line-through opacity-50' : ''
              }`}
              style={{ color: doc.collected ? 'var(--color-success-text)' : 'var(--color-text-primary)' }}
            >
              {doc.doc_name}
            </span>
          </button>
        ))}
      </div>

      {total === 0 && !adding && (
        <div 
          className="py-10 text-center rounded-lg border border-dashed flex flex-col items-center justify-center p-4"
          style={{ borderColor: 'var(--color-surface-2)' }}
        >
          <p className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
            No documents on checklist. Click &quot;Add Item&quot; to define required documents.
          </p>
        </div>
      )}
    </div>
  )
}
