'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, User } from 'lucide-react'

export interface ContactSuggestion {
  id: string
  name: string | null
  email: string[] | null
}

interface RecipientChipsInputProps {
  label: string
  emails: string[]
  onChange: (emails: string[]) => void
  dealId: string
  placeholder?: string
  disabled?: boolean
  showCcLink?: boolean
  showBccLink?: boolean
  onCcClick?: () => void
  onBccClick?: () => void
}

function isValidEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email)
}

function parseRecipient(str: string): { name?: string; email: string } {
  const match = str.match(/^(?:"?([^"]*)"?\s)?(?:<(.+)>|([^\s@]+@[^\s@]+\.[^\s@]+))$/)
  if (match) {
    const name = match[1]?.trim()
    const email = (match[2] || match[3])?.trim() ?? str
    return { name, email }
  }
  return { email: str.trim() }
}

function initials(name: string | null, email: string): string {
  if (name) {
    return name
      .split(' ')
      .map((w) => w[0] ?? '')
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }
  return email[0]?.toUpperCase() ?? '?'
}

export function RecipientChipsInput({
  label,
  emails,
  onChange,
  dealId,
  placeholder,
  disabled = false,
  showCcLink = false,
  showBccLink = false,
  onCcClick,
  onBccClick,
}: RecipientChipsInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [suggestions, setSuggestions] = useState<ContactSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)

  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fetchIdRef = useRef(0)

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

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
      // Ignore
    }
  }, [dealId])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setInputValue(val)
    const id = ++fetchIdRef.current
    if (val.length >= 1) {
      fetchSuggestions(val, id)
    } else {
      setOpen(false)
      setSuggestions([])
    }
  }, [fetchSuggestions])

  const addChip = useCallback((emailStr: string) => {
    const trimmed = emailStr.trim()
    if (!trimmed) return
    // Avoid duplicates
    if (!emails.includes(trimmed)) {
      onChange([...emails, trimmed])
    }
    setInputValue('')
    setOpen(false)
    setSuggestions([])
    inputRef.current?.focus()
  }, [emails, onChange])

  const removeChip = useCallback((index: number) => {
    const updated = emails.filter((_, i) => i !== index)
    onChange(updated)
    inputRef.current?.focus()
  }, [emails, onChange])

  const selectSuggestion = useCallback((contact: ContactSuggestion) => {
    const primaryEmail = contact.email?.[0] ?? ''
    const display = contact.name ? `"${contact.name}" <${primaryEmail}>` : primaryEmail
    addChip(display)
  }, [addChip])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !inputValue && emails.length > 0) {
      // Remove last chip
      e.preventDefault()
      removeChip(emails.length - 1)
    } else if ((e.key === 'Enter' || e.key === 'Tab' || e.key === ',' || e.key === ';') && inputValue) {
      e.preventDefault()
      if (open && suggestions.length > 0 && suggestions[highlightIndex]) {
        selectSuggestion(suggestions[highlightIndex]!)
      } else {
        addChip(inputValue)
      }
    } else if (open && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlightIndex((prev) => (prev + 1) % suggestions.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlightIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
  }, [inputValue, emails, open, suggestions, highlightIndex, addChip, removeChip, selectSuggestion])

  const handleContainerClick = () => {
    inputRef.current?.focus()
  }

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div
        onClick={handleContainerClick}
        className="flex flex-wrap items-center gap-1.5 px-1 py-1.5 min-h-[36px] border-b text-[13px] transition-colors cursor-text focus-within:border-b-[var(--color-accent)] outline-none rounded-none"
        style={{
          background: 'transparent',
          borderColor: 'var(--color-surface-2)',
        }}
      >
        {/* Label */}
        <span className="text-[12px] font-medium mr-1 select-none" style={{ color: 'var(--color-text-tertiary)' }}>
          {label}
        </span>

        {/* Chips */}
        {emails.map((rawEmail, idx) => {
          const { name, email } = parseRecipient(rawEmail)
          const valid = isValidEmail(email)
          return (
            <div
              key={`${idx}-${rawEmail}`}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[11px] select-none"
              style={{
                background: valid ? 'var(--color-surface-2)' : 'var(--color-danger-bg)',
                borderColor: valid ? 'var(--color-surface-3)' : 'var(--color-danger-border)',
                color: valid ? 'var(--color-text-primary)' : 'var(--color-danger-text)',
              }}
              title={email}
            >
              {/* Initials avatar */}
              <div
                className="h-4 w-4 rounded-full flex items-center justify-center text-[8px] font-bold"
                style={{
                  background: valid ? 'var(--color-text-secondary)' : 'var(--color-danger-solid)',
                  color: 'var(--color-text-inverse)',
                }}
              >
                {initials(name ?? null, email)}
              </div>
              <span className="max-w-[120px] truncate">{name || email}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  removeChip(idx)
                }}
                disabled={disabled}
                className="hover:opacity-80 transition-opacity"
              >
                <X size={10} />
              </button>
            </div>
          )
        })}

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={emails.length === 0 ? placeholder : ''}
          disabled={disabled}
          className="flex-1 min-w-[80px] bg-transparent outline-none focus:outline-none border-none p-0 text-[13px] h-6"
          style={{ color: 'var(--color-text-primary)' }}
        />

        {/* CC / BCC quick toggles (To field only) */}
        {showCcLink && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onCcClick?.()
            }}
            className="text-[11px] font-medium ml-1 hover:underline select-none"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            Cc
          </button>
        )}
        {showBccLink && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onBccClick?.()
            }}
            className="text-[11px] font-medium ml-1 hover:underline select-none"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            Bcc
          </button>
        )}
      </div>

      {/* Autocomplete suggestions dropdown */}
      {open && suggestions.length > 0 && (
        <div
          className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg border shadow-lg overflow-hidden max-h-[200px] overflow-y-auto"
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
              onClick={() => selectSuggestion(c)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors ${
                i === highlightIndex ? 'bg-[var(--color-surface-1)]' : ''
              }`}
              style={{ color: 'var(--color-text-primary)' }}
            >
              <User size={14} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
              <div className="min-w-0 flex-1">
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
