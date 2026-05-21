'use client'

import { useState } from 'react'
import { Phone, Voicemail, Pencil, Users, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { formatDate } from '@/lib/utils'

export interface Activity {
  id: string
  type: 'call' | 'voicemail' | 'note' | 'meeting' | 'other'
  summary: string
  logged_at: string
  profiles: { full_name: string } | null
}

interface ActivityTimelineProps {
  activities?: Activity[]
  isLoading?: boolean
  lastContactedAt?: string | null
  onAddActivity: (data: { type: string; summary: string }) => Promise<void>
}

const typeIcons: Record<string, typeof Phone> = {
  call: Phone,
  voicemail: Voicemail,
  note: Pencil,
  meeting: Users,
  other: MoreHorizontal,
}

const typeLabels: Record<string, string> = {
  call: 'Call',
  voicemail: 'Voicemail',
  note: 'Note',
  meeting: 'Meeting',
  other: 'Other',
}

export function ActivityTimeline({ activities, isLoading, lastContactedAt, onAddActivity }: ActivityTimelineProps) {
  const [type, setType] = useState<string>('call')
  const [summary, setSummary] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!summary.trim() || submitting) return
    setSubmitting(true)
    try {
      await onAddActivity({ type, summary: summary.trim() })
      setSummary('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {lastContactedAt && (
        <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          Last contacted: {formatDate(lastContactedAt)}
        </p>
      )}

      {/* Inline form */}
      <div className="flex gap-2 items-end">
        <div className="w-32">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="h-[34px] text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(typeLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Input
          className="flex-1 h-[34px] text-[13px]"
          placeholder="Summary..."
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
        />
        <Button
          size="sm"
          style={{ background: 'var(--accent)', color: 'var(--color-text-inverse)' }}
          onClick={handleSubmit}
          disabled={!summary.trim() || submitting}
        >
          {submitting ? <LoadingSpinner size="sm" /> : 'Log'}
        </Button>
      </div>

      {/* Timeline */}
      {isLoading ? (
        <div className="flex justify-center py-8"><LoadingSpinner size="md" /></div>
      ) : !activities?.length ? (
        <EmptyState title="No activity logged yet" />
      ) : (
        <div className="space-y-0">
          {activities.map((a) => {
            const Icon = typeIcons[a.type] ?? Pencil
            return (
              <div
                key={a.id}
                className="flex gap-3 py-3 border-b"
                style={{ borderColor: 'var(--color-surface-2)' }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: 'var(--color-surface-1)' }}
                >
                  <Icon className="h-3.5 w-3.5" style={{ color: 'var(--color-text-secondary)' }} />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px]" style={{ color: 'var(--color-text-primary)' }}>{a.summary}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                    {a.profiles?.full_name ?? 'Unknown'} · {formatDate(a.logged_at)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
