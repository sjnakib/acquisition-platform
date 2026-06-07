'use client'

import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { X, Undo2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { DataGrid, type ColumnDef } from '@/components/shared/DataGrid'
import { Tooltip } from '@/components/ui/tooltip'
import type { ColumnActionInput } from '@/lib/validations/import.schema'
import { toast } from 'sonner'

interface FieldDef {
  id: string
  key: string
  label: string
  data_type: string
}

interface PreviousMappingData {
  source_headers: string[]
  column_mapping: Record<string, ColumnActionInput>
}

interface Props {
  data: Record<string, unknown>[]
  headers: string[]
  mapping: Record<string, ColumnActionInput>
  fieldDefs: FieldDef[]
  previousMapping?: PreviousMappingData | null
  batchId: string
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

function resolveTargetLabel(
  header: string,
  mapping: Record<string, ColumnActionInput>,
  previousMapping: PreviousMappingData | null | undefined,
  fieldDefs: FieldDef[],
): string {
  const source = mapping
  const action = source[header]
  if (!action || action.action === 'drop') return ''
  if (action.action === 'email_target') return '→ Email Target'
  if (action.action === 'field') {
    const fd = fieldDefs.find((f) => f.key === action.key)
    return `→ ${fd?.label ?? action.key}`
  }
  if (action.action === 'new_field') return `→ New: ${action.label}`
  return ''
}

function selectValue(action: ColumnActionInput | undefined): string {
  const a = action?.action ?? 'drop'
  if (a === 'email_target') return 'email_target'
  if (a === 'field') return `field:${(action as { key: string }).key}`
  if (a === 'new_field') return 'new_field'
  return 'drop'
}

export function ImportPreviewTable({
  data,
  headers,
  mapping,
  fieldDefs,
  previousMapping,
  batchId,
  onChange,
}: Props) {
  const [expandedNewField, setExpandedNewField] = useState<string | null>(null)
  const previousActionsRef = useRef<Record<string, ColumnActionInput>>({})
  const [lastChanged, setLastChanged] = useState<{ header: string } | null>(null)

  // Auto-clear mapping feedback flash after 1.5s
  useEffect(() => {
    if (!lastChanged) return
    const timer = setTimeout(() => setLastChanged(null), 1500)
    return () => clearTimeout(timer)
  }, [lastChanged])

  // Apply a dropdown value change to the column mapping state
  const applyMappingChange = useCallback(
    (header: string, value: string) => {
      if (value === 'email_target') {
        setExpandedNewField(null)
        onChange(header, { action: 'email_target' })
      } else if (value.startsWith('field:')) {
        setExpandedNewField(null)
        onChange(header, { action: 'field', key: value.slice(6) })
      } else if (value === 'new_field') {
        const key = header
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_|_$/g, '')
        onChange(header, { action: 'new_field', key, label: header, dataType: 'text' })
        setExpandedNewField(header)
      } else {
        setExpandedNewField(null)
        onChange(header, { action: 'drop' })
      }
    },
    [onChange],
  )

  const handleSelectChange = useCallback(
    (header: string, value: string) => {
      const currentAction = mapping[header]
      const currentVal = selectValue(currentAction)

      // No-op if value hasn't changed
      if (value === currentVal) return

      // Warn whenever user changes an already-mapped column
      if (currentAction && currentAction.action !== 'drop') {
        const currentLabel =
          resolveTargetLabel(header, mapping, previousMapping, fieldDefs) ||
          'a field'
        const newLabel =
          value === 'email_target'
            ? 'Email Target'
            : value.startsWith('field:')
              ? `"${fieldDefs.find((fd) => fd.key === value.slice(6))?.label ?? value.slice(6)}"`
              : value === 'new_field'
                ? '"New Field"'
                : '"Drop"'

        toast.warning(
          `Column "${header}" is already mapped to ${currentLabel}. Change to ${newLabel}?`,
          {
            action: {
              label: 'Change',
              onClick: () => {
                applyMappingChange(header, value)
                setLastChanged({ header })
              },
            },
            cancel: {
              label: 'Cancel',
              onClick: () => {},
            },
            duration: 5000,
          },
        )
        return
      }

      applyMappingChange(header, value)
      setLastChanged({ header })
    },
    [mapping, fieldDefs, previousMapping, applyMappingChange],
  )

  const availableFields = useMemo(
    () => fieldDefs.filter((fd) => fd.key),
    [fieldDefs],
  )

  const columns: ColumnDef<Record<string, unknown>>[] = useMemo(() => {
    if (!data.length) return []
    return headers.map((header) => {
      const action = mapping[header]
      const isDropped = !action || action.action === 'drop'
      const currentAction = action?.action ?? 'drop'
      const isNewFieldExpanded = expandedNewField === header

      return {
        key: header,
        header,
        sortable: false,
        minWidth: 130,
        maxWidth: 350,
        align: 'left' as const,
        headerRender: () => {
          const targetLabel = resolveTargetLabel(header, mapping, previousMapping, fieldDefs)

          return (
            <div
              className={`flex flex-col gap-0.5 w-full min-w-0${isDropped ? ' column-dropped rounded-sm px-1' : ''}`}
            >
              {/* Target label — or new-field inline form */}
              {currentAction === 'new_field' && isNewFieldExpanded ? (
                <div className="flex items-center gap-1" style={{ minHeight: 20 }}>
                  <Input
                    placeholder="key"
                    value={(action as { key?: string }).key ?? ''}
                    onChange={(e) =>
                      onChange(header, {
                        ...action,
                        key: e.target.value,
                      } as ColumnActionInput)
                    }
                    className="h-5 text-[10px]"
                    style={{
                      fontFamily: 'var(--font-jetbrains-mono)',
                      width: 60,
                      minWidth: 0,
                    }}
                  />
                  <Input
                    placeholder="label"
                    value={
                      (action as { label?: string }).label ?? ''
                    }
                    onChange={(e) =>
                      onChange(header, {
                        ...action,
                        label: e.target.value,
                      } as ColumnActionInput)
                    }
                    className="h-5 text-[10px] flex-1 min-w-0"
                  />
                  <Select
                    value={
                      (action as { dataType?: string }).dataType ?? 'text'
                    }
                    onValueChange={(v) =>
                      onChange(header, {
                        ...action,
                        dataType: v,
                      } as ColumnActionInput)
                    }
                  >
                    <SelectTrigger
                      className="h-5 text-[10px]"
                      style={{ width: 55, flexShrink: 0 }}
                    />
                    <SelectContent>
                      {DATA_TYPES.map((dt) => (
                        <SelectItem key={dt.value} value={dt.value}>
                          {dt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setExpandedNewField(null)
                      onChange(header, { action: 'drop' })
                    }}
                    className="flex-shrink-0 p-0.5 rounded hover:bg-[var(--color-surface-3)]"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  >
                    <X size={11} />
                  </button>
                </div>
              ) : (
                <div className="min-h-[16px] flex items-center">
                  {currentAction !== 'drop' && targetLabel ? (
                    <Badge
                      variant={lastChanged?.header === header ? 'success' : 'accent'}
                      size="sm"
                      className={
                        lastChanged?.header === header ? 'animate-cell-success' : ''
                      }
                    >
                      {targetLabel}
                    </Badge>
                  ) : currentAction === 'drop' ? (
                    <Badge variant="neutral" size="sm">
                      Dropped
                    </Badge>
                  ) : (
                    <span
                      className="text-[10px] leading-tight"
                      style={{ color: 'var(--color-text-tertiary)' }}
                    >
                      Select mapping
                    </span>
                  )}
                </div>
              )}

              {/* Source column name + controls */}
              <div className="flex items-center gap-1 min-w-0">
                <span
                  className="text-[11px] font-medium truncate flex-1 min-w-0"
                  style={{
                    color: isDropped
                      ? 'var(--color-text-tertiary)'
                      : 'var(--color-text-primary)',
                  }}
                >
                  {header}
                </span>

                {/* Mapping dropdown */}
                <Select
                  value={selectValue(action)}
                  onValueChange={(v) => handleSelectChange(header, v)}
                >
                  <SelectTrigger
                    className="h-5 text-[10px] border-0 p-0 flex-shrink-0"
                    style={{
                      color: 'var(--color-text-tertiary)',
                      background: 'transparent',
                      minWidth: 20,
                      width: 'auto',
                    }}
                  />
                  <SelectContent align="end" className="text-[12px]">
                    <SelectItem value="email_target">Email Target</SelectItem>
                    {availableFields.length > 0 && (
                      <>
                        <div
                          className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide"
                          style={{ color: 'var(--color-text-tertiary)' }}
                        >
                          Existing fields
                        </div>
                        {availableFields.map((fd) => (
                          <SelectItem key={fd.key} value={`field:${fd.key}`}>
                            {fd.label}{' '}
                            <span
                              style={{
                                color: 'var(--color-text-tertiary)',
                                fontSize: 10,
                              }}
                            >
                              ({fd.key})
                            </span>
                          </SelectItem>
                        ))}
                      </>
                    )}
                    <div
                      className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide"
                      style={{ color: 'var(--color-text-tertiary)' }}
                    >
                      Other
                    </div>
                    <SelectItem value="new_field">+ New field</SelectItem>
                    <SelectItem value="drop">Drop</SelectItem>
                  </SelectContent>
                </Select>

                {/* Drop / restore toggle */}
                <Tooltip content={isDropped ? 'Restore column' : 'Drop column'}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (isDropped) {
                        const previous = previousActionsRef.current[header]
                        onChange(
                          header,
                          previous ?? { action: 'field', key: 'deal_name' },
                        )
                      } else {
                        // Save current mapping so restore goes back to it
                        if (mapping[header]) {
                          previousActionsRef.current[header] = mapping[header]!
                        }
                        setExpandedNewField(null)
                        onChange(header, { action: 'drop' })
                      }
                    }}
                    className="flex-shrink-0 p-0.5 rounded hover:bg-[var(--color-surface-3)] transition-colors"
                    style={{
                      color: isDropped
                        ? 'var(--color-text-tertiary)'
                        : 'var(--color-danger-text)',
                    }}
                  >
                    {isDropped ? <Undo2 size={11} /> : <X size={11} />}
                  </button>
                </Tooltip>
              </div>
            </div>
          )
        },
        ...(isDropped
          ? {
              render: (row: Record<string, unknown>) => (
                <span
                  className="truncate px-1 rounded-sm column-dropped"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  {(row[header] ?? '—') as string}
                </span>
              ),
            }
          : {}),
      }
    })
  }, [
    headers,
    mapping,
    fieldDefs,
    previousMapping,
    expandedNewField,
    availableFields,
    handleSelectChange,
    onChange,
    lastChanged,
    data,
  ])

  return (
    <DataGrid
      columns={columns}
      data={data}
      rowKey={(_, i) => String(i)}
      emptyMessage="No data to preview"
      maxHeight={480}
      columnOrderStorageKey={`import-preview-${batchId}`}
    />
  )
}
