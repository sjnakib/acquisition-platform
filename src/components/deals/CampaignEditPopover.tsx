'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface Campaign {
  id: string
  name: string
  market: string
}

interface CampaignEditPopoverProps {
  value: string
  onChange: (val: string) => void
  onCommit: () => void
  onDiscard: () => void
}

export function CampaignEditPopover({ value, onChange, onCommit, onDiscard }: CampaignEditPopoverProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [search, setSearch] = useState(value || '')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/campaigns')
      .then((res) => res.ok ? res.json() : [])
      .then((data: Campaign[]) => setCampaigns(data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const filtered = campaigns.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.market.toLowerCase().includes(search.toLowerCase())
  )

  const selectCampaign = useCallback((campaign: Campaign) => {
    onChange(campaign.id)
    onCommit()
  }, [onChange, onCommit])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((prev) => Math.min(prev + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[highlightedIndex]) {
        selectCampaign(filtered[highlightedIndex]!)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onDiscard()
    } else if (e.key === 'Tab') {
      e.preventDefault()
      onDiscard() // Spec §6.5: Tab dismisses popover without committing, moves focus to next cell
    }
  }, [filtered, highlightedIndex, selectCampaign, onDiscard])

  return (
    <div
      className="absolute z-50"
      style={{ top: 0, left: 0, width: 260 }}
      onKeyDown={handleKeyDown}
    >
      <input
        ref={inputRef}
        className="w-full px-3 py-2 text-[13px] outline-none"
        style={{
          background: 'var(--color-surface-0)',
          border: `2px solid var(--color-accent)`,
          color: 'var(--color-text-primary)',
          fontFamily: 'var(--font-dm-sans)',
        }}
        placeholder="Search campaigns..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value)
          setHighlightedIndex(0)
        }}
      />
      {filtered.length > 0 && (
        <div
          className="overflow-auto border-x border-b rounded-b-md shadow-lg"
          style={{
            maxHeight: 200,
            background: 'var(--color-surface-0)',
            borderColor: 'var(--color-surface-3)',
          }}
        >
          {filtered.map((c, i) => (
            <div
              key={c.id}
              className="flex items-center justify-between px-3 py-2 text-[13px] cursor-pointer"
              style={{
                background: i === highlightedIndex ? 'var(--color-accent-bg)' : 'transparent',
                color: 'var(--color-text-primary)',
              }}
              onMouseEnter={() => setHighlightedIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                selectCampaign(c)
              }}
            >
              <span>{c.name}</span>
              <span style={{ color: 'var(--color-text-tertiary)', fontSize: 11 }}>{c.market}</span>
            </div>
          ))}
        </div>
      )}
      {filtered.length === 0 && search && (
        <div
          className="px-3 py-2 text-[12px] border-x border-b rounded-b-md"
          style={{
            background: 'var(--color-surface-0)',
            borderColor: 'var(--color-surface-3)',
            color: 'var(--color-text-tertiary)',
          }}
        >
          No campaigns found
        </div>
      )}
    </div>
  )
}
