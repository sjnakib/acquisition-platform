'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Phone, User, Briefcase, FileText, Calendar, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'

interface CallBrief {
  id: string
  deal_id: string
  contact_name: string | null
  contact_role: string | null
  phone_number: string | null
  summary_text: string | null
  call_status: string
  published: boolean
  client_notes: string | null
  flagged_at: string
  completed_at: string | null
}

const STATUS_VARIANT: Record<string, 'success' | 'danger' | 'warning'> = {
  completed: 'success',
  cancelled: 'danger',
  pending: 'warning',
}

const FILTERS = ['all', 'pending', 'completed'] as const
type Filter = (typeof FILTERS)[number]

export function CallBriefTab({ dealId }: { dealId: string }) {
  const queryClient = useQueryClient()
  const [contactName, setContactName] = useState('')
  const [contactRole, setContactRole] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [summaryText, setSummaryText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')

  const { data: callBriefs = [], isLoading: loading } = useQuery<CallBrief[]>({
    queryKey: ['call-briefs', dealId],
    queryFn: async () => {
      const res = await fetch(`/api/calls?deal_id=${dealId}`)
      if (!res.ok) throw new Error('Failed to load calls')
      const data = await res.json()
      return Array.isArray(data) ? data : []
    },
    enabled: !!dealId,
  })

  async function handleCreate() {
    if (!contactName.trim() || !summaryText.trim() || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deal_id: dealId,
          contact_name: contactName.trim(),
          contact_role: contactRole.trim() || undefined,
          phone_number: phoneNumber.trim() || undefined,
          summary_text: summaryText.trim(),
        }),
      })
      if (res.ok) {
        await queryClient.invalidateQueries({ queryKey: ['call-briefs', dealId] })
        setContactName('')
        setContactRole('')
        setPhoneNumber('')
        setSummaryText('')
        setShowForm(false)
        toast.success('Follow-up call request created')
      } else {
        const json = await res.json()
        toast.error(json.error ?? 'Failed to create call request')
      }
    } catch {
      toast.error('Failed to create call request')
    } finally {
      setSubmitting(false)
    }
  }

  const filtered = filter === 'all'
    ? callBriefs
    : callBriefs.filter((cb) => cb.call_status === filter)

  return (
    <div className="space-y-5">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Follow-Up Calls
          </h3>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
            Track scheduled calls and their outcomes
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowForm(!showForm)}
          className="bg-[var(--color-accent)] border-none text-[var(--color-text-inverse)] h-8 text-[12px]"
        >
          <Phone size={13} />
          {showForm ? 'Cancel' : 'Request Call'}
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <div
          className="rounded-xl border p-5 space-y-3"
          style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-border)' }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              placeholder="Contact name *"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="h-[34px] text-[13px] bg-[var(--color-surface-1)] border-[var(--color-surface-3)] focus:border-[var(--color-accent)]"
            />
            <Input
              placeholder="Role / Designation"
              value={contactRole}
              onChange={(e) => setContactRole(e.target.value)}
              className="h-[34px] text-[13px] bg-[var(--color-surface-1)] border-[var(--color-surface-3)] focus:border-[var(--color-accent)]"
            />
            <Input
              placeholder="Phone number"
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="h-[34px] text-[13px] bg-[var(--color-surface-1)] border-[var(--color-surface-3)] focus:border-[var(--color-accent)]"
            />
          </div>
          <textarea
            placeholder="Why call? What to discuss — so the sponsor comes prepared. *"
            value={summaryText}
            onChange={(e) => setSummaryText(e.target.value)}
            rows={3}
            className="w-full text-[13px] rounded-md border px-3 py-2 resize-none outline-none focus:ring-1 focus:ring-[var(--accent)]"
            style={{
              background: 'var(--color-surface-1)',
              borderColor: 'var(--color-surface-3)',
              color: 'var(--color-text-primary)',
            }}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={!contactName.trim() || !summaryText.trim() || submitting}
              className="bg-[var(--color-accent)] border-none text-[var(--color-text-inverse)] h-8 text-[12px]"
              onClick={handleCreate}
            >
              {submitting ? <LoadingSpinner size="sm" /> : 'Create Call Request'}
            </Button>
          </div>
        </div>
      )}

      {/* Status filter */}
      {callBriefs.length > 0 && (
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-[11px] font-medium rounded-md capitalize transition-colors ${
                filter === f
                  ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                  : ''
              }`}
              style={filter !== f ? { color: 'var(--color-text-tertiary)' } : {}}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {/* Call list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="md" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Phone}
          title={filter !== 'all' ? `No ${filter} calls` : 'No call requests yet'}
          description={filter === 'all' ? 'Request a follow-up call to notify the sponsor.' : undefined}
          action={filter === 'all' ? { label: 'Request Call', onClick: () => setShowForm(true) } : undefined}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((cb) => (
            <div
              key={cb.id}
              className="rounded-xl border p-4 transition-colors hover:border-[var(--color-surface-3)]"
              style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-border)' }}
            >
              {/* Top row: status + date + publish */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_VARIANT[cb.call_status] ?? 'warning'} size="sm">
                    {cb.call_status}
                  </Badge>
                  {cb.published ? (
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded inline-flex items-center gap-1"
                      style={{ background: 'var(--color-info-bg)', color: 'var(--color-info-text)' }}
                    >
                      <Eye size={10} /> Published
                    </span>
                  ) : (
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded inline-flex items-center gap-1"
                      style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-tertiary)' }}
                    >
                      <EyeOff size={10} /> Draft
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] inline-flex items-center gap-1" style={{ color: 'var(--color-text-tertiary)' }}>
                    <Calendar size={11} />
                    {formatDate(cb.flagged_at)}
                  </span>
                  {cb.completed_at && (
                    <span className="text-[11px] inline-flex items-center gap-1" style={{ color: 'var(--color-success-text)' }}>
                      Completed {formatDate(cb.completed_at)}
                    </span>
                  )}
                </div>
              </div>

              {/* Contact info */}
              {(cb.contact_name || cb.contact_role || cb.phone_number) && (
                <div className="flex flex-wrap gap-x-5 gap-y-1 mb-3 text-[13px]">
                  {cb.contact_name && (
                    <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--color-text-primary)' }}>
                      <User size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                      <span className="font-medium">{cb.contact_name}</span>
                    </span>
                  )}
                  {cb.contact_role && (
                    <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                      <Briefcase size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                      {cb.contact_role}
                    </span>
                  )}
                  {cb.phone_number && (
                    <a
                      href={`tel:${cb.phone_number}`}
                      className="inline-flex items-center gap-1.5 hover:underline"
                      style={{ color: 'var(--color-accent)' }}
                    >
                      <Phone size={14} />
                      {cb.phone_number}
                    </a>
                  )}
                </div>
              )}

              {/* Call notes */}
              <div className="flex items-start gap-2 mb-3">
                <FileText size={14} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  {cb.summary_text || 'No call notes.'}
                </p>
              </div>

              {/* Client notes */}
              {cb.client_notes && (
                <div
                  className="rounded-lg p-3 text-[13px] border-l-2"
                  style={{
                    background: 'var(--color-surface-1)',
                    color: 'var(--color-text-secondary)',
                    borderLeftColor: 'var(--color-accent)',
                  }}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-[0.03em] block mb-1" style={{ color: 'var(--color-text-tertiary)' }}>
                    Sponsor Notes
                  </span>
                  {cb.client_notes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
