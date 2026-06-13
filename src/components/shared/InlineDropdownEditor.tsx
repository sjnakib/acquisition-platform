'use client'

import { useCallback, useRef } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface InlineDropdownEditorProps {
  value: string
  options: { value: string; label: string }[]
  onChange: (val: string) => void
  onCommit: (value?: string) => void
  onDiscard: () => void
  placeholder?: string
}

export function InlineDropdownEditor({
  value,
  options,
  onChange,
  onCommit,
  onDiscard,
  placeholder = 'Select...',
}: InlineDropdownEditorProps) {
  const committedRef = useRef(false)

  const handleValueChange = useCallback(
    (val: string) => {
      committedRef.current = true
      onChange(val)
      onCommit(val)
    },
    [onChange, onCommit],
  )

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        // Defer so onValueChange always fires first regardless of
        // Radix Select's internal event ordering, then check whether
        // the user committed a value or dismissed without selecting.
        setTimeout(() => {
          if (!committedRef.current) onDiscard()
          committedRef.current = false
        }, 0)
      }
    },
    [onDiscard],
  )

  return (
    <Select defaultOpen value={value} onValueChange={handleValueChange} onOpenChange={handleOpenChange}>
      <SelectTrigger
        className="absolute inset-0 w-full h-full border-0 bg-transparent rounded-none shadow-none focus:ring-0 focus:outline-none"
        style={{
          fontFamily: 'var(--font-dm-sans)',
          fontSize: '13px',
          color: 'var(--color-text-primary)',
          padding: '0 12px',
        }}
      >
        <SelectValue placeholder={placeholder}>
          {options.find((o) => o.value === value)?.label ?? (value || placeholder)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        position="popper"
        sideOffset={4}
        align="start"
        style={{
          fontFamily: 'var(--font-dm-sans)',
          background: 'var(--color-surface-0)',
          borderColor: 'var(--color-surface-3)',
        }}
      >
        {options.map((opt) => (
          <SelectItem
            key={opt.value}
            value={opt.value}
            style={{
              fontFamily: 'var(--font-dm-sans)',
              fontSize: '13px',
            }}
          >
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
