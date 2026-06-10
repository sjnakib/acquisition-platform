'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { Pencil, FileText } from 'lucide-react'
import { toast } from 'sonner'

interface FieldDef {
  value: string | null
  label: string
  data_type: string
}

type FieldsMap = Record<string, FieldDef>

export function DealFieldsEditor({ dealId }: { dealId: string }) {
  const queryClient = useQueryClient()
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const { data: fields, isLoading: loading } = useQuery<FieldsMap>({
    queryKey: ['deal', dealId, 'fields'],
    queryFn: async () => {
      const res = await fetch(`/api/deals/${dealId}/fields`)
      if (!res.ok) throw new Error('Failed to load fields')
      return res.json()
    },
    enabled: !!dealId,
  })

  const saveFieldMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string | null }) => {
      const res = await fetch(`/api/deals/${dealId}/fields`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Failed to save')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal', dealId, 'fields'] })
      setEditingKey(null)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to save field')
    },
  })

  const startEdit = useCallback((key: string, currentValue: string | null) => {
    setEditingKey(key)
    setEditValue(currentValue ?? '')
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingKey(null)
    setEditValue('')
  }, [])

  const saveEdit = useCallback(() => {
    if (!editingKey) return
    saveFieldMutation.mutate({ key: editingKey, value: editValue || null })
  }, [editingKey, editValue, saveFieldMutation])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveEdit()
    if (e.key === 'Escape') cancelEdit()
  }, [saveEdit, cancelEdit])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="md" />
      </div>
    )
  }

  if (!fields || Object.keys(fields).length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No imported fields"
        description="Import property data to populate deal fields."
      />
    )
  }

  const entries = Object.entries(fields)
    .filter(([, def]) => def.label)
    .sort((a, b) => a[1].label.localeCompare(b[1].label))

  function renderInput(def: FieldDef) {
    switch (def.data_type) {
      case 'number':
      case 'integer':
      case 'currency':
        return (
          <Input
            type="number"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={saveEdit}
            autoFocus
            className="h-8 text-[13px] font-mono bg-[var(--color-surface-1)] border-[var(--color-surface-3)] focus:border-[var(--color-accent)]"
          />
        )
      case 'url':
        return (
          <Input
            type="url"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={saveEdit}
            autoFocus
            className="h-8 text-[13px] bg-[var(--color-surface-1)] border-[var(--color-surface-3)] focus:border-[var(--color-accent)]"
          />
        )
      case 'boolean':
        return (
          <select
            value={editValue}
            onChange={(e) => { setEditValue(e.target.value); }}
            onBlur={saveEdit}
            autoFocus
            className="h-8 text-[13px] bg-[var(--color-surface-1)] border border-[var(--color-surface-3)] rounded-md px-2 focus:border-[var(--color-accent)] outline-none"
            style={{ color: 'var(--color-text-primary)' }}
          >
            <option value="">—</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        )
      case 'date':
        return (
          <Input
            type="date"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={saveEdit}
            autoFocus
            className="h-8 text-[13px] bg-[var(--color-surface-1)] border-[var(--color-surface-3)] focus:border-[var(--color-accent)]"
          />
        )
      default:
        return (
          <Input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={saveEdit}
            autoFocus
            className="h-8 text-[13px] bg-[var(--color-surface-1)] border-[var(--color-surface-3)] focus:border-[var(--color-accent)]"
          />
        )
    }
  }

  function displayValue(def: FieldDef): string {
    if (def.value === null || def.value === '') return '—'
    if (def.data_type === 'boolean') return def.value === 'true' ? 'Yes' : 'No'
    if (def.data_type === 'url') return def.value
    if (def.data_type === 'currency' && def.value) {
      const n = Number(def.value)
      return isNaN(n) ? def.value : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
    }
    return def.value
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
      {entries.map(([key, def]) => {
        const isEditing = editingKey === key
        return (
          <div
            key={key}
            className="flex items-start justify-between py-2.5 border-b group"
            style={{ borderColor: 'var(--color-surface-2)' }}
          >
            <div className="min-w-0 flex-1">
              <span
                className="block text-[11px] font-medium uppercase tracking-[0.03em] mb-0.5"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                {def.label}
              </span>
              {isEditing ? (
                <div className="flex items-center gap-1.5 mt-0.5">
                  {renderInput(def)}
                  {saveFieldMutation.isPending && <LoadingSpinner size="sm" />}
                </div>
              ) : (
                <span
                  className="text-[13px] font-medium cursor-pointer hover:underline decoration-dotted underline-offset-2"
                  style={{ color: 'var(--color-text-primary)' }}
                  onClick={() => startEdit(key, def.value)}
                  title="Click to edit"
                >
                  {displayValue(def)}
                </span>
              )}
            </div>
            {!isEditing && (
              <button
                onClick={() => startEdit(key, def.value)}
                className="ml-2 mt-5 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-[var(--color-surface-2)]"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                <Pencil size={13} />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
