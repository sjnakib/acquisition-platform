'use client'

import { useState, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

interface FieldDef {
  key: string
  label: string
  data_type: string
  sort_order: number
}

interface DealField {
  value: string | null
  label: string
  data_type: string
}

interface DynamicFieldPanelProps {
  fields: Record<string, DealField>
  fieldDefs: FieldDef[]
  onSave: (key: string, value: string) => Promise<void>
}

export function DynamicFieldPanel({ fields, fieldDefs, onSave }: DynamicFieldPanelProps) {
  const [editing, setEditing] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<Set<string>>(new Set())

  const handleBlur = useCallback(async (key: string) => {
    const val = editing[key]
    if (val === undefined) return
    const currentVal = fields[key]?.value ?? ''
    if (val === currentVal) return

    setSaving((s) => new Set(s).add(key))
    try {
      await onSave(key, val)
    } finally {
      setSaving((s) => { const n = new Set(s); n.delete(key); return n })
    }
  }, [editing, fields, onSave])

  const sorted = [...fieldDefs].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {sorted.map((fd) => {
        const val = editing[fd.key] ?? fields[fd.key]?.value ?? ''
        const isLoading = saving.has(fd.key)

        return (
          <div key={fd.key} className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>
              {fd.label}
            </label>
            <div className="relative">
              <Input
                className="h-[34px] text-[13px] pr-8"
                value={val}
                onChange={(e) => setEditing((prev) => ({ ...prev, [fd.key]: e.target.value }))}
                onBlur={() => handleBlur(fd.key)}
                placeholder="—"
              />
              {isLoading && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <LoadingSpinner size="sm" />
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
