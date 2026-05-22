'use client'

import { useMemo } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import type { ColumnActionInput } from '@/lib/validations/import.schema'

interface FieldDef {
  id: string
  key: string
  label: string
  data_type: string
}

interface Props {
  headers: string[]
  mapping: Record<string, ColumnActionInput>
  fieldDefs: FieldDef[]
  onChange: (header: string, action: ColumnActionInput) => void
}

const DATA_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'integer', label: 'Integer' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'url', label: 'URL' },
  { value: 'currency', label: 'Currency' },
] as const

const sectionStyle = {
  background: 'var(--color-surface-0)',
  border: '1px solid var(--color-surface-2)',
  borderRadius: 'var(--radius-lg)',
  padding: 16,
} as const

export function ColumnMappingPanel({ headers, mapping, fieldDefs, onChange }: Props) {
  const mappedCount = useMemo(
    () => Object.values(mapping).filter((a) => a.action !== 'drop').length,
    [mapping],
  )

  return (
    <div style={sectionStyle}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3
            className="text-[15px] font-medium"
            style={{ fontFamily: 'var(--font-dm-sans)', color: 'var(--color-text-primary)' }}
          >
            Column Mapping
          </h3>
          <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
            {headers.length} column{headers.length !== 1 ? 's' : ''} found &middot; {mappedCount} mapped,{' '}
            {headers.length - mappedCount} dropped
          </p>
        </div>
      </div>

      <div className="space-y-2 max-h-[360px] overflow-y-auto">
        {headers.map((header) => {
          const action = mapping[header]
          return (
            <MappingRow
              key={header}
              header={header}
              action={action}
              fieldDefs={fieldDefs}
              onChange={(a) => onChange(header, a)}
            />
          )
        })}
      </div>
    </div>
  )
}

function MappingRow({
  header,
  action,
  fieldDefs,
  onChange,
}: {
  header: string
  action: ColumnActionInput | undefined
  fieldDefs: FieldDef[]
  onChange: (action: ColumnActionInput) => void
}) {
  const currentAction = action?.action ?? 'drop'

  return (
    <div
      className="flex items-start gap-3 py-2 px-3 rounded-md"
      style={{
        background: currentAction === 'drop' ? 'var(--color-surface-1)' : 'var(--color-surface-0)',
        border: `1px solid ${currentAction === 'drop' ? 'var(--color-surface-2)' : 'var(--color-surface-3)'}`,
      }}
    >
      {/* Column name */}
      <div className="flex-1 min-w-0 pt-1.5">
        <span
          className="text-[13px] font-medium truncate block"
          style={{
            color: currentAction === 'drop' ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)',
          }}
        >
          {header}
        </span>
      </div>

      {/* Action selector */}
      <div style={{ width: 180, flexShrink: 0 }}>
        <Select
          value={currentAction}
          onValueChange={(v) => {
            if (v === 'system') onChange({ action: 'system', field: 'deal_name' })
            else if (v === 'email_target') onChange({ action: 'email_target' })
            else if (v === 'unit_count') onChange({ action: 'unit_count' })
            else if (v === 'field') {
              const first = fieldDefs[0]
              if (first) onChange({ action: 'field', key: first.key })
            } else if (v === 'new_field') {
              const key = header.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
              onChange({ action: 'new_field', key, label: header, dataType: 'text' })
            } else {
              onChange({ action: 'drop' })
            }
          }}
        >
          <SelectTrigger
            className="h-8 text-[12px]"
            style={{
              borderColor: currentAction === 'drop' ? 'var(--color-surface-3)' : 'var(--accent)',
            }}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="system">Deal Name</SelectItem>
            <SelectItem value="email_target">Email Target</SelectItem>
            <SelectItem value="unit_count">Unit Count</SelectItem>
            <SelectItem value="field">Map to existing field</SelectItem>
            <SelectItem value="new_field">Create new field</SelectItem>
            <SelectItem value="drop">Drop</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Conditional inputs */}
      <div style={{ width: 220, flexShrink: 0 }}>
        {currentAction === 'new_field' && (
          <div className="flex flex-col gap-1">
            <Input
              placeholder="Field key"
              value={action && 'key' in action ? action.key ?? '' : ''}
              onChange={(e) => {
                if (action && 'key' in action) {
                  onChange({ ...action, key: e.target.value } as ColumnActionInput)
                }
              }}
              className="h-7 text-[11px]"
              style={{ fontFamily: 'var(--font-jetbrains-mono)' }}
            />
            <div className="flex gap-1">
              <Input
                placeholder="Label"
                value={action && 'label' in action ? action.label ?? '' : ''}
                onChange={(e) => {
                  if (action && 'label' in action) {
                    onChange({ ...action, label: e.target.value } as ColumnActionInput)
                  }
                }}
                className="h-7 text-[11px] flex-1"
              />
              <Select
                value={action && 'dataType' in action ? action.dataType ?? 'text' : 'text'}
                onValueChange={(v) => {
                  if (action && 'dataType' in action) {
                    onChange({ ...action, dataType: v } as ColumnActionInput)
                  }
                }}
              >
                <SelectTrigger className="h-7 text-[11px] w-[85px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATA_TYPES.map((dt) => (
                    <SelectItem key={dt.value} value={dt.value}>
                      {dt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        {currentAction === 'field' && (
          <Select
            value={action && 'key' in action ? action.key ?? '' : ''}
            onValueChange={(v) => {
              if (v) onChange({ action: 'field', key: v })
            }}
          >
            <SelectTrigger className="h-8 text-[12px]">
              <SelectValue placeholder="Select field..." />
            </SelectTrigger>
            <SelectContent>
              {fieldDefs
                .filter((fd) => fd.key)
                .map((fd) => (
                  <SelectItem key={fd.key} value={fd.key}>
                    {fd.label} ({fd.key})
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  )
}
