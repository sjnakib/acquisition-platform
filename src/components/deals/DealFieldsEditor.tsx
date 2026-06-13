'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { Pencil, FileText, Search, MapPin, DollarSign, Building, Users, Info, X } from 'lucide-react'
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
  const [searchQuery, setSearchQuery] = useState('')

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
      queryClient.invalidateQueries({ queryKey: ['deal', dealId] }) // Invalidate main deal query for unit count or address updates
      queryClient.invalidateQueries({ queryKey: ['deals'] }) // Invalidate table/list views
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

  // Filter and sort entries based on search query
  const entries = Object.entries(fields)
    .filter(([, def]) => def.label)
    .filter(([, def]) => 
      !searchQuery.trim() || 
      def.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      displayValue(def).toLowerCase().includes(searchQuery.toLowerCase())
    )
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
            className="h-8 text-[13px] font-mono bg-[var(--color-surface-1)] border-[var(--color-surface-3)] focus:border-[var(--color-accent)] w-full"
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
            className="h-8 text-[13px] bg-[var(--color-surface-1)] border-[var(--color-surface-3)] focus:border-[var(--color-accent)] w-full"
          />
        )
      case 'boolean':
        return (
          <select
            value={editValue}
            onChange={(e) => { setEditValue(e.target.value); }}
            onBlur={saveEdit}
            autoFocus
            className="h-8 text-[13px] bg-[var(--color-surface-1)] border border-[var(--color-surface-3)] rounded-md px-2 focus:border-[var(--color-accent)] outline-none w-full"
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
            className="h-8 text-[13px] bg-[var(--color-surface-1)] border-[var(--color-surface-3)] focus:border-[var(--color-accent)] w-full"
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
            className="h-8 text-[13px] bg-[var(--color-surface-1)] border-[var(--color-surface-3)] focus:border-[var(--color-accent)] w-full"
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

  // Define categories structure
  const categories = {
    location: { label: 'Location & Demographics', keys: [] as [string, FieldDef][], icon: MapPin },
    financials: { label: 'Financials & Performance', keys: [] as [string, FieldDef][], icon: DollarSign },
    building: { label: 'Property & Building Specs', keys: [] as [string, FieldDef][], icon: Building },
    contacts: { label: 'Contacts & Sources', keys: [] as [string, FieldDef][], icon: Users },
    general: { label: 'General & Metadata', keys: [] as [string, FieldDef][], icon: Info }
  }

  // Populate categories
  entries.forEach(([key, def]) => {
    const k = key.toLowerCase()
    if (
      k.includes('address') || k.includes('city') || k.includes('state') || 
      k.includes('zip') || k.includes('county') || k.includes('location') || 
      k.includes('gps') || k.includes('lat') || k.includes('lng') || 
      k.includes('pop') || k.includes('demograph')
    ) {
      categories.location.keys.push([key, def])
    } else if (
      k.includes('price') || k.includes('rent') || k.includes('asking') || 
      k.includes('revenue') || k.includes('expense') || k.includes('cap_rate') || 
      k.includes('growth') || k.includes('tax') || k.includes('insurance') || 
      k.includes('capex') || k.includes('irr') || k.includes('equity') || 
      k.includes('noi') || k.includes('profit') || k.includes('financial') || 
      k.includes('cost') || k.includes('valuation')
    ) {
      categories.financials.keys.push([key, def])
    } else if (
      k.includes('unit') || k.includes('sf') || k.includes('sqft') || 
      k.includes('year') || k.includes('built') || k.includes('story') || 
      k.includes('stories') || k.includes('type') || k.includes('parking') || 
      k.includes('construction') || k.includes('zoning') || k.includes('amenities') || 
      k.includes('size') || k.includes('acre') || k.includes('beds') || 
      k.includes('baths') || k.includes('utilities')
    ) {
      categories.building.keys.push([key, def])
    } else if (
      k.includes('contact') || k.includes('email') || k.includes('phone') || 
      k.includes('broker') || k.includes('owner') || k.includes('sponsor') || 
      k.includes('source') || k.includes('target') || k.includes('website')
    ) {
      categories.contacts.keys.push([key, def])
    } else {
      categories.general.keys.push([key, def])
    }
  })

  const activeCategories = Object.entries(categories).filter(([, cat]) => cat.keys.length > 0)

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative flex items-center">
        <Search className="absolute left-3 h-4 w-4 text-[var(--color-text-tertiary)] pointer-events-none" />
        <Input
          placeholder="Search property fields..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 pr-8 h-9 text-[13px] bg-[var(--color-surface-1)] border-[var(--color-surface-3)] focus:border-[var(--color-accent)]"
        />
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery('')}
            className="absolute right-3 p-0.5 rounded-full hover:bg-[var(--color-surface-2)] text-[var(--color-text-tertiary)]"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {activeCategories.length === 0 ? (
        <div className="text-center py-8 border border-dashed rounded-xl" style={{ borderColor: 'var(--color-surface-3)' }}>
          <p className="text-xs text-[var(--color-text-tertiary)]">No fields match your search query.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeCategories.map(([catKey, cat]) => {
            const Icon = cat.icon
            return (
              <div
                key={catKey}
                className="rounded-xl border p-4 shadow-xs flex flex-col bg-[var(--color-surface-0)] border-[var(--color-surface-2)]"
              >
                {/* Category Header */}
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[var(--color-surface-2)]">
                  <Icon className="h-4 w-4 text-[var(--color-accent)]" />
                  <h4 className="text-[12px] font-semibold text-[var(--color-text-primary)]">
                    {cat.label}
                  </h4>
                  <Badge variant="neutral" size="sm" className="ml-auto text-[10px] py-0 px-1.5 h-4 font-mono">
                    {cat.keys.length}
                  </Badge>
                </div>

                {/* Category Fields List */}
                <div className="space-y-2.5 flex-1">
                  {cat.keys.map(([key, def]) => {
                    const isEditing = editingKey === key
                    return (
                      <div
                        key={key}
                        className="flex items-start justify-between py-1 group/row relative rounded px-1 -mx-1 hover:bg-[var(--color-surface-1)] transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <span
                            className="block text-[10px] font-medium uppercase tracking-[0.03em] mb-0.5 text-[var(--color-text-tertiary)]"
                          >
                            {def.label}
                          </span>
                          {isEditing ? (
                            <div className="flex items-center gap-1.5 mt-0.5 max-w-[90%]">
                              {renderInput(def)}
                              {saveFieldMutation.isPending && <LoadingSpinner size="sm" />}
                            </div>
                          ) : (
                            <span
                              className="text-[13px] font-medium cursor-pointer hover:underline decoration-dotted underline-offset-2 break-all text-[var(--color-text-primary)]"
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
                            className="ml-2 opacity-0 group-hover/row:opacity-100 transition-opacity p-1 rounded hover:bg-[var(--color-surface-2)] text-[var(--color-text-tertiary)] self-center"
                          >
                            <Pencil size={11} />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

