'use client'

import { useMemo, useState, useCallback, useRef } from 'react'
import { X, Undo2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tooltip } from '@/components/ui/tooltip'
import type { ColumnActionInput } from '@/lib/validations/import.schema'

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

function slugify(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '') || 'field'
  )
}

function selectValue(action: ColumnActionInput | undefined): string {
  if (!action || action.action === 'drop') return 'drop'
  if (action.action === 'email_target') return 'email_target'
  if (action.action === 'field') return `field:${(action as { key: string }).key}`
  if (action.action === 'new_field') return 'new_field'
  return 'drop'
}

function getActionLabel(
  action: ColumnActionInput | undefined,
  fieldDefs: FieldDef[],
): string {
  if (!action || action.action === 'drop') return 'Drop column'
  if (action.action === 'email_target') return 'Email Target'
  if (action.action === 'field') {
    const key = (action as { key: string }).key
    if (key === 'address') return 'Address'
    if (key === 'unit_count') return 'Units'
    const fd = fieldDefs.find((f) => f.key === key)
    return fd?.label ?? key
  }
  if (action.action === 'new_field') {
    return `New field: ${(action as { label?: string }).label?.trim() || '(unnamed)'}`
  }
  return 'Drop column'
}

interface RemapPending {
  header: string
  value: string
  fromLabel: string
  toLabel: string
}

export function ImportPreviewTable({
  data,
  headers,
  mapping,
  fieldDefs,
  onChange,
}: Props) {
  const previousActionsRef = useRef<Record<string, ColumnActionInput>>({})
  const [remapPending, setRemapPending] = useState<RemapPending | null>(null)

  const applyMappingChange = useCallback(
    (header: string, value: string) => {
      if (value === 'email_target') {
        onChange(header, { action: 'email_target' })
      } else if (value.startsWith('field:')) {
        onChange(header, { action: 'field', key: value.slice(6) })
      } else if (value === 'new_field') {
        const key = slugify(header)
        onChange(header, { action: 'new_field', key, label: header, dataType: 'text' })
      } else {
        onChange(header, { action: 'drop' })
      }
    },
    [onChange],
  )

  const handleSelectChange = useCallback(
    (header: string, value: string) => {
      const currentAction = mapping[header]
      const currentVal = selectValue(currentAction)
      if (value === currentVal) return

      // Guard: confirm before remapping an already-assigned column
      if (currentAction && currentAction.action !== 'drop') {
        const fromLabel = getActionLabel(currentAction, fieldDefs)
        let toLabel = 'Drop'
        if (value === 'email_target') {
          toLabel = 'Email Target'
        } else if (value === 'new_field') {
          toLabel = 'New Field'
        } else if (value.startsWith('field:')) {
          const key = value.slice(6)
          if (key === 'address') {
            toLabel = 'Address'
          } else if (key === 'unit_count') {
            toLabel = 'Units'
          } else {
            toLabel = fieldDefs.find((fd) => fd.key === key)?.label ?? key
          }
        }
        setRemapPending({ header, value, fromLabel, toLabel })
        return
      }

      applyMappingChange(header, value)
    },
    [mapping, fieldDefs, applyMappingChange],
  )

  const confirmRemap = useCallback(() => {
    if (!remapPending) return
    applyMappingChange(remapPending.header, remapPending.value)
    setRemapPending(null)
  }, [remapPending, applyMappingChange])

  const existingFields = useMemo(
    () => fieldDefs.filter((fd) => fd.key && fd.key !== 'address' && fd.key !== 'unit_count'),
    [fieldDefs],
  )

  // Pre-compute 3 representative sample values for each header
  const sampleValues = useMemo(() => {
    const result: Record<string, string> = {}
    for (const header of headers) {
      const samples = data
        .map((row) => row[header])
        .filter((v) => v !== null && v !== undefined && v !== '')
        .slice(0, 3)
        .map((v) => String(v))
      result[header] = samples.length ? samples.join(' · ') : '—'
    }
    return result
  }, [headers, data])

  return (
    <>
      {/* ── Column mapping table ─────────────────────────────────── */}
      <div
        className="flex-1 flex flex-col min-h-0 rounded-lg border overflow-hidden"
        style={{
          borderColor: 'var(--color-surface-3)',
          background: 'var(--color-surface-0)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {/* Header row */}
        <div
          className="grid items-center px-4 py-2 border-b text-[10px] font-semibold uppercase tracking-widest"
          style={{
            gridTemplateColumns: '200px 1fr 260px 36px',
            background: 'var(--color-surface-1)',
            borderColor: 'var(--color-surface-3)',
            color: 'var(--color-text-tertiary)',
          }}
        >
          <div>Source column</div>
          <div>Sample values</div>
          <div>Map to</div>
          <div />
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto pb-2">
          {headers.map((header) => {
            const action = mapping[header]
            const isDropped = !action || action.action === 'drop'

            return (
              <div
                key={header}
                className="grid items-center px-4 border-b last:border-b-0 transition-opacity"
                style={{
                  gridTemplateColumns: '200px 1fr 260px 36px',
                  borderColor: 'var(--color-surface-2)',
                  minHeight: 44,
                  opacity: isDropped ? 0.5 : 1,
                }}
              >
                {/* Col A — Source column name */}
                <div className="py-2.5 pr-4 min-w-0 flex items-center">
                  <Tooltip
                    content={header.length > 20 ? header : ''}
                    position="right"
                  >
                    <span
                      className="text-[12px] font-semibold truncate block"
                      style={{
                        fontFamily: 'var(--font-jetbrains-mono)',
                        color: 'var(--color-text-primary)',
                        letterSpacing: '0.01em',
                      }}
                    >
                      {header}
                    </span>
                  </Tooltip>
                </div>

                {/* Col B — Sample values */}
                <div className="py-2.5 pr-4 min-w-0 flex items-center">
                  <span
                    className="text-[11px] truncate block"
                    style={{ color: 'var(--color-text-tertiary)' }}
                    title={sampleValues[header]}
                  >
                    {sampleValues[header]}
                  </span>
                </div>

                {/* Col C — Mapping control */}
                <div className="py-2 pr-3 min-w-0 flex items-center">
                  <Select
                    value={selectValue(action)}
                    onValueChange={(v) => handleSelectChange(header, v)}
                  >
                    <SelectTrigger className="h-8 w-full text-sm">
                      <span className="truncate">
                        {getActionLabel(action, fieldDefs)}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <div
                        className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >
                        Required
                      </div>
                      <SelectItem value="field:address">Address</SelectItem>
                      <SelectItem value="email_target">Email Target</SelectItem>
                      <SelectItem value="field:unit_count">Units</SelectItem>

                      {existingFields.length > 0 && (
                        <>
                          <div
                            className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest"
                            style={{ color: 'var(--color-text-tertiary)' }}
                          >
                            Existing fields
                          </div>
                          {existingFields.map((fd) => (
                            <SelectItem
                              key={fd.key}
                              value={`field:${fd.key}`}
                            >
                              {fd.label}
                            </SelectItem>
                          ))}
                        </>
                      )}

                      <div
                        className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >
                        Others
                      </div>
                      <SelectItem value="new_field">New Field</SelectItem>
                      <SelectItem value="drop">Drop column</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Col D — Drop / restore toggle */}
                <div className="flex items-center justify-center">
                  <Tooltip
                    content={isDropped ? 'Restore column' : 'Drop column'}
                    position="left"
                  >
                    <button
                      onClick={() => {
                        if (isDropped) {
                          const previous = previousActionsRef.current[header]
                          onChange(
                            header,
                            previous ?? { action: 'new_field', key: slugify(header), label: header, dataType: 'text' },
                          )
                        } else {
                          if (mapping[header]) {
                            previousActionsRef.current[header] = mapping[header]!
                          }
                          onChange(header, { action: 'drop' })
                        }
                      }}
                      className="w-7 h-7 rounded flex items-center justify-center transition-colors hover:bg-[var(--color-surface-3)]"
                      style={{
                        color: isDropped
                          ? 'var(--color-text-tertiary)'
                          : 'var(--color-danger-text)',
                      }}
                    >
                      {isDropped ? <Undo2 size={13} /> : <X size={13} />}
                    </button>
                  </Tooltip>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Remap confirmation dialog ────────────────────────────── */}
      <Dialog
        open={!!remapPending}
        onOpenChange={(open) => {
          if (!open) setRemapPending(null)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Change Column Mapping?</DialogTitle>
            <DialogDescription>
              <span
                className="font-medium"
                style={{ color: 'var(--color-text-primary)' }}
              >
                &ldquo;{remapPending?.header}&rdquo;
              </span>{' '}
              is already mapped to{' '}
              <span
                className="font-medium"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {remapPending?.fromLabel}
              </span>
              .
            </DialogDescription>
          </DialogHeader>

          <div
            className="flex items-center gap-2 rounded-md px-3 py-2.5 text-[12px]"
            style={{
              background: 'var(--color-surface-1)',
              border: '1px solid var(--color-surface-3)',
            }}
          >
            <span
              className="truncate"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {remapPending?.fromLabel}
            </span>
            <span
              className="flex-shrink-0 font-semibold"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              →
            </span>
            <span
              className="font-semibold truncate"
              style={{ color: 'var(--accent)' }}
            >
              {remapPending?.toLabel}
            </span>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRemapPending(null)}
            >
              Cancel
            </Button>
            <Button onClick={confirmRemap}>Confirm Change</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
