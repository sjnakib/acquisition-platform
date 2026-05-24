'use client'

import { useState, useEffect } from 'react'
import { Phone, User, Briefcase, FileText } from 'lucide-react'
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

const statusVariant: Record<string, 'success' | 'danger' | 'warning'> = {
  completed: 'success',
  cancelled: 'danger',
  pending: 'warning',
}

export function CallBriefTab({ dealId }: { dealId: string }) {
  const [callBriefs, setCallBriefs] = useState<CallBrief[]>([])
  const [loading, setLoading] = useState(true)
  const [contactName, setContactName] = useState('')
  const [contactRole, setContactRole] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [summaryText, setSummaryText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!dealId) return
    const controller = new AbortController()
    setLoading(true)
    fetch(`/api/calls?deal_id=${dealId}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => setCallBriefs(Array.isArray(data) ? data : []))
      .catch((err) => {
        if (err.name !== 'AbortError') console.error(err)
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [dealId])

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
        const created = await res.json()
        setCallBriefs((prev) => [created, ...prev])
        setContactName('')
        setContactRole('')
        setPhoneNumber('')
        setSummaryText('')
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

  return (
    <div className="space-y-8">
      {/* Request Follow-Up Call form */}
      <div
        className="rounded-xl border p-5"
        style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-border)' }}
      >
        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
          Request Follow-Up Call
        </h3>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Input
                placeholder="Contact name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="h-[34px] text-[13px]"
              />
            </div>
            <div>
              <Input
                placeholder="Role / Designation"
                value={contactRole}
                onChange={(e) => setContactRole(e.target.value)}
                className="h-[34px] text-[13px]"
              />
            </div>
            <div>
              <Input
                placeholder="Phone number"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="h-[34px] text-[13px]"
              />
            </div>
          </div>
          <div>
            <textarea
              placeholder="Why call? What to discuss — so the sponsor comes prepared."
              value={summaryText}
              onChange={(e) => setSummaryText(e.target.value)}
              rows={3}
              className="w-full text-[13px] rounded-md border px-3 py-2 resize-none outline-none focus:ring-1 focus:ring-[var(--accent)]"
              style={{
                background: 'var(--color-surface-0)',
                borderColor: 'var(--color-surface-3)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              style={{ background: 'var(--accent)', color: 'var(--color-text-inverse)' }}
              onClick={handleCreate}
              disabled={!contactName.trim() || !summaryText.trim() || submitting}
            >
              {submitting ? <LoadingSpinner size="sm" /> : 'Create Call Request'}
            </Button>
          </div>
        </div>
      </div>

      {/* Call History */}
      <div>
        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
          Call History
        </h3>
        {loading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="md" />
          </div>
        ) : !callBriefs.length ? (
          <EmptyState
            icon={Phone}
            title="No call requests yet"
            description="Create a follow-up call request to notify the sponsor."
          />
        ) : (
          <div className="space-y-3">
            {callBriefs.map((cb) => (
              <div
                key={cb.id}
                className="rounded-xl border p-4"
                style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-border)' }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={statusVariant[cb.call_status] ?? 'warning'} size="sm">
                      {cb.call_status}
                    </Badge>
                    {cb.published && (
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--color-info-bg)', color: 'var(--color-info-text)' }}
                      >
                        Published
                      </span>
                    )}
                  </div>
                  <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                    {formatDate(cb.flagged_at)}
                  </span>
                </div>

                {/* Contact info row */}
                {(cb.contact_name || cb.contact_role || cb.phone_number) && (
                  <div className="flex flex-wrap gap-x-5 gap-y-1 mb-3 text-[13px]">
                    {cb.contact_name && (
                      <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--color-text-primary)' }}>
                        <User className="h-3.5 w-3.5" style={{ color: 'var(--color-text-tertiary)' }} />
                        {cb.contact_name}
                      </span>
                    )}
                    {cb.contact_role && (
                      <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                        <Briefcase className="h-3.5 w-3.5" style={{ color: 'var(--color-text-tertiary)' }} />
                        {cb.contact_role}
                      </span>
                    )}
                    {cb.phone_number && (
                      <a
                        href={`tel:${cb.phone_number}`}
                        className="inline-flex items-center gap-1.5 hover:underline"
                        style={{ color: 'var(--accent)' }}
                      >
                        <Phone className="h-3.5 w-3.5" />
                        {cb.phone_number}
                      </a>
                    )}
                  </div>
                )}

                {/* Call notes */}
                <div className="flex items-start gap-2 mb-3">
                  <FileText className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
                  <p className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
                    {cb.summary_text || 'No call notes.'}
                  </p>
                </div>

                {/* Sponsor notes */}
                {cb.client_notes && (
                  <div
                    className="rounded-lg p-3 text-[13px]"
                    style={{ background: 'var(--color-surface-1)', color: 'var(--color-text-secondary)' }}
                  >
                    <span className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-tertiary)' }}>
                      Sponsor Notes:
                    </span>
                    {cb.client_notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
