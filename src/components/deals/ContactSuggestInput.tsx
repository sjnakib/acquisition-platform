'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { User } from 'lucide-react'

export interface ContactSuggestion {
  id: string
  name: string | null
  email: string[] | null  // contacts table stores email as text[]
}

interface ContactSuggestInputProps {
  value: string
  onChange: (value: string) => void
  onSelect: (contact: ContactSuggestion) => void
  dealId: string
  placeholder?: string
  disabled?: boolean
}

export function ContactSuggestInput({
  value, onChange, onSelect, dealId, placeholder, disabled,
}: ContactSuggestInputProps) {
  const [suggestions, setSuggestions] = useState<ContactSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fetchIdRef = useRef(0)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Fetch suggestions with debounce
  const fetchSuggestions = useCallback(async (search: string, id: number) => {
    try {
      const url = `/api/deals/${dealId}/contacts${search ? `?search=${encodeURIComponent(search)}` : ''}`
      const res = await fetch(url)
      if (!res.ok || id !== fetchIdRef.current) return
      const data = await res.json()
      if (id === fetchIdRef.current) {
        setSuggestions(data ?? [])
        setOpen((data ?? []).length > 0)
        setHighlightIndex(0)
      }
    } catch {
      // Silently ignore fetch errors
    }
  }, [dealId])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    onChange(val)
    const id = ++fetchIdRef.current
    // Extract search text (might be an email if user already selected)
    const search = val.includes('<') ? val.split('<').pop()?.replace('>', '')?.trim() ?? val : val
    if (search.length >= 1) {
      fetchSuggestions(search, id)
    } else {
      setOpen(false)
      setSuggestions([])
    }
  }, [onChange, fetchSuggestions])

  const selectContact = useCallback((contact: ContactSuggestion) => {
    const primaryEmail = contact.email?.[0] ?? ''
    const display = contact.name ? `${contact.name} <${primaryEmail}>` : primaryEmail
    onChange(display)
    onSelect(contact)
    setOpen(false)
    setSuggestions([])
  }, [onChange, onSelect])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex((prev) => (prev + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const contact = suggestions[highlightIndex]
      if (contact) selectContact(contact)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }, [open, suggestions, highlightIndex, selectContact])

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onFocus={() => { if (suggestions.length > 0) setOpen(true) }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? 'To: email@example.com'}
        disabled={disabled}
        className="h-8 text-[13px] bg-[var(--color-surface-0)] border-[var(--color-surface-3)] focus:border-[var(--color-accent)]"
      />
      {open && suggestions.length > 0 && (
        <div
          className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg border shadow-lg overflow-hidden"
          style={{
            background: 'var(--color-surface-0)',
            borderColor: 'var(--color-surface-2)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {suggestions.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onClick={() => selectContact(c)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors ${
                i === highlightIndex ? 'bg-[var(--color-surface-1)]' : ''
              }`}
              style={{ color: 'var(--color-text-primary)' }}
            >
              <User size={14} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
              <div className="min-w-0">
                {c.name && <div className="truncate font-medium">{c.name}</div>}
                <div className="truncate text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                  {c.email?.[0] ?? 'No email'}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
