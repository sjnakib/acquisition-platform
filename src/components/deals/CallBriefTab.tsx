'use client'

import { useState, useCallback, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Phone, User, Briefcase, FileText, Calendar, Eye, EyeOff, Edit3, Check, X, MessageSquare, Info, ChevronDown, ChevronUp, Clock } from 'lucide-react'
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
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')

  // Edit states for individual calls
  const [editingCallId, setEditingCallId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editSummary, setEditSummary] = useState('')

  // Accordion state
  const searchParams = useSearchParams()
  const activeCallId = searchParams.get('callId')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // Saving states for inline notes
  const [savingNotes, setSavingNotes] = useState<Record<string, 'team' | 'sponsor' | null>>({})

  useEffect(() => {
    if (activeCallId) {
      setExpandedIds(new Set([activeCallId]))
    }
  }, [activeCallId])

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

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

  const createCallMutation = useMutation({
    mutationFn: async () => {
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
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Failed to create call request')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-briefs', dealId] })
      queryClient.invalidateQueries({ queryKey: ['deals'] })
      setContactName('')
      setContactRole('')
      setPhoneNumber('')
      setSummaryText('')
      setShowForm(false)
      toast.success('Follow-up call request created')
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to create call request'),
  })

  const updateCallMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/calls/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Failed to update call brief')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-briefs', dealId] })
      queryClient.invalidateQueries({ queryKey: ['deals'] })
      setEditingCallId(null)
      toast.success('Call request updated')
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to update call request'),
  })

  const handleSaveNoteInline = async (callId: string, type: 'team' | 'sponsor', notes: string) => {
    setSavingNotes((prev) => ({ ...prev, [callId]: type }))
    try {
      const body = type === 'team' ? { summary_text: notes } : { client_notes: notes }
      const res = await fetch(`/api/calls/${callId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ['call-briefs', dealId] })
      queryClient.invalidateQueries({ queryKey: ['deals'] })
      } else {
        toast.error('Failed to save notes')
      }
    } catch {
      toast.error('Failed to save notes')
    } finally {
      setSavingNotes((prev) => ({ ...prev, [callId]: null }))
    }
  }

  function handleCreate() {
    if (!contactName.trim() || !summaryText.trim() || createCallMutation.isPending) return
    createCallMutation.mutate()
  }

  function handleStartEdit(cb: CallBrief) {
    setEditingCallId(cb.id)
    setEditName(cb.contact_name ?? '')
    setEditRole(cb.contact_role ?? '')
    setEditPhone(cb.phone_number ?? '')
    setEditSummary(cb.summary_text ?? '')
  }

  function handleSaveEdit(id: string) {
    if (!editName.trim() || !editSummary.trim() || updateCallMutation.isPending) return
    updateCallMutation.mutate({
      id,
      data: {
        contact_name: editName.trim(),
        contact_role: editRole.trim() || null,
        phone_number: editPhone.trim() || null,
        summary_text: editSummary.trim(),
      },
    })
  }

  const togglePublish = useCallback((id: string, currentPublished: boolean) => {
    updateCallMutation.mutate({
      id,
      data: { published: !currentPublished },
    })
  }, [updateCallMutation])

  const filtered = filter === 'all'
    ? callBriefs
    : callBriefs.filter((cb) => cb.call_status === filter)

  return (
    <div className="space-y-5">
      {/* Header with actions */}
      <div className="flex items-center justify-between pb-3 border-b border-[var(--color-surface-2)]">
        <div>
          <h3 className="text-[14px] font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Follow-Up Calls
          </h3>
          <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">
            Queue and draft call briefs to prepare sponsors for broker or owner outreach.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowForm(!showForm)}
          className="bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90 border-none text-[var(--color-text-inverse)] h-8 text-[12px] font-medium shadow-xs gap-1.5"
        >
          <Phone size={13} />
          {showForm ? 'Cancel' : 'Request Call'}
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <div
          className="rounded-xl border p-4 space-y-3 bg-[var(--color-surface-0)] border-[var(--color-surface-2)] shadow-xs"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              placeholder="Contact name *"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="h-9 text-[13px] bg-[var(--color-surface-1)] border-[var(--color-surface-3)] focus:border-[var(--color-accent)]"
            />
            <Input
              placeholder="Role / Designation"
              value={contactRole}
              onChange={(e) => setContactRole(e.target.value)}
              className="h-9 text-[13px] bg-[var(--color-surface-1)] border-[var(--color-surface-3)] focus:border-[var(--color-accent)]"
            />
            <Input
              placeholder="Phone number"
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="h-9 text-[13px] bg-[var(--color-surface-1)] border-[var(--color-surface-3)] focus:border-[var(--color-accent)]"
            />
          </div>
          <textarea
            placeholder="Why call? What to discuss — so the sponsor comes prepared. *"
            value={summaryText}
            onChange={(e) => setSummaryText(e.target.value)}
            rows={3}
            className="w-full text-[13px] rounded-lg border border-[var(--color-surface-3)] px-3 py-2.5 resize-none outline-none focus:ring-0 focus:border-[var(--color-accent)] bg-[var(--color-surface-1)] text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)]"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={!contactName.trim() || !summaryText.trim() || createCallMutation.isPending}
              className="bg-[var(--color-accent)] text-[var(--color-text-inverse)] h-8 text-[12px] font-medium shadow-xs"
              onClick={handleCreate}
            >
              {createCallMutation.isPending ? <LoadingSpinner size="sm" /> : 'Create Call Request'}
            </Button>
          </div>
        </div>
      )}

      {/* Status filter */}
      {callBriefs.length > 0 && (
        <div className="flex gap-1.5 pb-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-[11px] font-semibold rounded-lg capitalize border transition-all ${
                filter === f
                  ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)] border-[var(--color-accent)] shadow-xs'
                  : 'bg-[var(--color-surface-0)] border-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-1)]'
              }`}
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
          {filtered.map((cb) => {
            const isEditing = editingCallId === cb.id
            const isExpanded = expandedIds.has(cb.id)
            return (
              <div
                key={cb.id}
                className={`rounded-xl border bg-[var(--color-surface-0)] border-[var(--color-surface-2)] shadow-xs transition-all hover:border-[var(--color-surface-3)] overflow-hidden ${
                  cb.id === activeCallId ? 'animate-card-flash' : ''
                }`}
              >
                {/* Collapsed Header Clickable Bar */}
                <div
                  onClick={() => toggleExpand(cb.id)}
                  className="flex items-center justify-between p-4 cursor-pointer select-none bg-[var(--color-surface-0)] hover:bg-[var(--color-surface-1)] transition-colors"
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <Badge variant={STATUS_VARIANT[cb.call_status] ?? 'warning'} size="sm" className="font-semibold">
                      {cb.call_status}
                    </Badge>
                    {cb.published ? (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg inline-flex items-center gap-1 bg-[var(--color-info-bg)] text-[var(--color-info-text)] border border-[var(--color-info-border)] shadow-xs">
                        <Eye size={10} /> Published
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg inline-flex items-center gap-1 bg-[var(--color-surface-2)] text-[var(--color-text-tertiary)] border border-[var(--color-surface-3)]">
                        <EyeOff size={10} /> Draft (Hidden)
                      </span>
                    )}
                    <span className="font-bold text-[13px] text-[var(--color-text-primary)]">
                      {cb.contact_name || 'Unnamed Target'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                    <span className="text-[10px] font-semibold font-mono text-[var(--color-text-tertiary)] inline-flex items-center gap-1">
                      <Calendar size={11} />
                      {formatDate(cb.flagged_at)}
                    </span>
                    <button
                      onClick={() => toggleExpand(cb.id)}
                      className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] p-0.5 focus:outline-none cursor-pointer"
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {/* Expanded Card Details */}
                {isExpanded && (
                  <div className="p-4 border-t border-[var(--color-surface-2)] bg-[var(--color-surface-0)] space-y-4">
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between pb-1.5 border-b border-[var(--color-surface-2)]">
                          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-[var(--color-text-secondary)]">Edit Call Request</span>
                          <div className="flex items-center gap-1">
                            <Button 
                              size="sm" 
                              onClick={() => handleSaveEdit(cb.id)} 
                              className="h-7 px-2 text-[11px] bg-[var(--color-accent)] text-[var(--color-text-inverse)]"
                              disabled={updateCallMutation.isPending}
                            >
                              <Check size={11} className="mr-1" /> Save
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => setEditingCallId(null)} 
                              className="h-7 px-2 text-[11px]"
                            >
                              <X size={11} className="mr-1" /> Cancel
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="Contact name *"
                            className="h-8 text-[12px] bg-[var(--color-surface-1)] border-[var(--color-surface-3)]"
                          />
                          <Input
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value)}
                            placeholder="Role / Designation"
                            className="h-8 text-[12px] bg-[var(--color-surface-1)] border-[var(--color-surface-3)]"
                          />
                          <Input
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                            placeholder="Phone number"
                            className="h-8 text-[12px] bg-[var(--color-surface-1)] border-[var(--color-surface-3)]"
                          />
                        </div>
                        <textarea
                          value={editSummary}
                          onChange={(e) => setEditSummary(e.target.value)}
                          placeholder="Why call? *"
                          rows={2.5}
                          className="w-full text-[12px] rounded-lg border border-[var(--color-surface-3)] px-3 py-2 bg-[var(--color-surface-1)] text-[var(--color-text-primary)] focus:outline-none resize-none"
                        />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Status Select & Action Buttons */}
                        <div className="flex items-center justify-between pb-3 border-b border-[var(--color-surface-2)] flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-[var(--color-text-secondary)]">Call Status:</span>
                            <select
                              value={cb.call_status}
                              onChange={(e) => {
                                updateCallMutation.mutate({ id: cb.id, data: { call_status: e.target.value } })
                              }}
                              className="text-[12px] border rounded-lg px-2.5 py-1 font-semibold outline-none cursor-pointer bg-[var(--color-surface-1)] border-[var(--color-surface-3)] text-[var(--color-text-primary)]"
                            >
                              <option value="pending">Pending</option>
                              <option value="completed">Completed</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </div>
                          <div className="flex items-center gap-2">
                            {cb.call_status === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleStartEdit(cb)}
                                  className="h-7 px-2 text-[11px] font-medium border-[var(--color-surface-3)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                                >
                                  <Edit3 size={11} className="mr-1" /> Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant={cb.published ? 'outline' : 'default'}
                                  onClick={() => togglePublish(cb.id, cb.published)}
                                  className={`h-7 px-2.5 text-[11px] font-medium ${
                                    cb.published 
                                      ? 'border-[var(--color-surface-3)] text-[var(--color-text-secondary)]' 
                                      : 'bg-[var(--color-success-bg)] border-[var(--color-success-border)] text-[var(--color-success-text)] hover:bg-[var(--color-success-bg)]/80'
                                  }`}
                                >
                                  {cb.published ? <><EyeOff size={11} className="mr-1" /> Revert to Draft</> : <><Eye size={11} className="mr-1" /> Publish to Sponsor</>}
                                </Button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Contact Info Details Row */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[var(--color-surface-1)] p-3 rounded-lg border border-[var(--color-surface-2)]">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-[0.03em] text-[var(--color-text-tertiary)] block">Contact Name *</span>
                            <span className="text-[13px] font-semibold text-[var(--color-text-primary)] block mt-0.5">{cb.contact_name || '—'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-[0.03em] text-[var(--color-text-tertiary)] block">Role / Designation</span>
                            <span className="text-[13px] text-[var(--color-text-primary)] block mt-0.5">{cb.contact_role || '—'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-[0.03em] text-[var(--color-text-tertiary)] block">Phone Number</span>
                            {cb.phone_number ? (
                              <a href={`tel:${cb.phone_number}`} className="text-[13px] font-mono text-[var(--color-accent)] font-semibold hover:underline block mt-0.5">{cb.phone_number}</a>
                            ) : (
                              <span className="text-[13px] text-[var(--color-text-primary)] block mt-0.5">—</span>
                            )}
                          </div>
                        </div>

                        {/* Notes side-by-side */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-3.5 rounded-xl border bg-[var(--color-surface-0)] border-[var(--color-surface-2)] flex flex-col gap-1.5 shadow-2xs relative">
                            <span className="text-[10px] font-bold uppercase tracking-[0.03em] text-[var(--color-text-tertiary)] flex items-center gap-1.5 pb-1 border-b border-[var(--color-surface-2)]">
                              <FileText size={11.5} className="text-[var(--color-accent)]" /> Note Left by Team (Sponsor Prep)
                            </span>
                            <textarea
                              defaultValue={cb.summary_text ?? ''}
                              onBlur={async (e) => {
                                const val = e.target.value
                                if (val !== (cb.summary_text ?? '')) {
                                  await handleSaveNoteInline(cb.id, 'team', val)
                                }
                              }}
                              placeholder="Why call? What to discuss..."
                              rows={3}
                              className="w-full text-[12px] rounded-lg border px-2.5 py-1.5 resize-none outline-none transition-all focus:border-[var(--color-accent)] focus:ring-0 bg-[var(--color-surface-1)] border-[var(--color-surface-3)] text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] mt-1"
                              disabled={savingNotes[cb.id] === 'team'}
                            />
                            {savingNotes[cb.id] === 'team' && (
                              <span className="absolute right-3 bottom-3 text-[9px] font-medium text-[var(--color-text-tertiary)] inline-flex items-center gap-1">
                                <Clock className="h-2.5 w-2.5 animate-spin" /> Saving...
                              </span>
                            )}
                          </div>

                          <div className="p-3.5 rounded-xl border bg-[var(--color-surface-0)] border-[var(--color-surface-2)] flex flex-col gap-1.5 shadow-2xs relative">
                            <span className="text-[10px] font-bold uppercase tracking-[0.03em] text-[var(--color-text-tertiary)] flex items-center gap-1.5 pb-1 border-b border-[var(--color-surface-2)]">
                              <MessageSquare size={11.5} className="text-[var(--color-accent)]" /> Note Left by Sponsor (Feedback)
                            </span>
                            <textarea
                              defaultValue={cb.client_notes ?? ''}
                              onBlur={async (e) => {
                                const val = e.target.value
                                if (val !== (cb.client_notes ?? '')) {
                                  await handleSaveNoteInline(cb.id, 'sponsor', val)
                                }
                              }}
                              placeholder="Describe what had been discussed in the call..."
                              rows={3}
                              className="w-full text-[12px] rounded-lg border px-2.5 py-1.5 resize-none outline-none transition-all focus:border-[var(--color-accent)] focus:ring-0 bg-[var(--color-surface-1)] border-[var(--color-surface-3)] text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] mt-1"
                              disabled={savingNotes[cb.id] === 'sponsor'}
                            />
                            {savingNotes[cb.id] === 'sponsor' && (
                              <span className="absolute right-3 bottom-3 text-[9px] font-medium text-[var(--color-text-tertiary)] inline-flex items-center gap-1">
                                <Clock className="h-2.5 w-2.5 animate-spin" /> Saving...
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
