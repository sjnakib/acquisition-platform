'use client'

import { useState, use, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Building2, Phone, FileText, Calendar, MapPin, ChevronDown, ChevronUp, Clock, User, Briefcase, MessageSquare } from 'lucide-react'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { Breadcrumb } from '@/components/shared/Breadcrumb'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useProjectContext } from '@/components/shared/ProjectContext'
import { DealScoreBadge } from '@/components/deals/DealScoreBadge'
import { useDeal } from '@/lib/hooks/useDeal'
import { formatDate } from '@/lib/utils'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

interface FieldValue {
  value: string | null
  field_definitions: { key: string; label: string; data_type: string } | null
}

interface CallBrief {
  id: string
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

interface DealDetail {
  id: string
  stage: string
  score: string | null
  project_id: string
  deal_fields: FieldValue[] | null
  call_briefs: CallBrief[] | null
}

const statusVariant: Record<string, 'success' | 'danger' | 'warning'> = {
  completed: 'success',
  cancelled: 'danger',
  pending: 'warning',
}

const stageVariant: Record<string, 'neutral' | 'info' | 'warning' | 'accent' | 'success'> = {
  lead: 'neutral',
  outreach: 'info',
  response: 'info',
  underwriting: 'warning',
  loi: 'accent',
  closed: 'success',
  failed: 'neutral',
  archived: 'neutral',
}

export default function ClientDealDetailPage({ params }: { params: Promise<{ id: string; dealId: string }> }) {
  const { id: projectId, dealId } = use(params)
  const { projectName } = useProjectContext()
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeCallId = searchParams.get('callId')
  const queryClient = useQueryClient()
  const { data: deal, isLoading: loading } = useDeal<DealDetail>(dealId)

  const [expandedCallIds, setExpandedCallIds] = useState<Set<string>>(new Set())
  const [savingNotes, setSavingNotes] = useState<Record<string, 'team' | 'sponsor' | null>>({})

  const [prevActiveCallId, setPrevActiveCallId] = useState<string | null>(activeCallId)
  if (activeCallId !== prevActiveCallId) {
    setPrevActiveCallId(activeCallId)
    if (activeCallId) {
      setExpandedCallIds(new Set([activeCallId]))
    }
  }

  const toggleExpandCall = (id: string) => {
    setExpandedCallIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleUpdateStatus = async (callId: string, status: string) => {
    try {
      const res = await fetch(`/api/calls/${callId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_status: status }),
      })
      if (res.ok) {
        toast.success('Call status updated')
        queryClient.invalidateQueries({ queryKey: ['deal', dealId] })
      } else {
        toast.error('Failed to update status')
      }
    } catch {
      toast.error('Failed to update status')
    }
  }

  const handleSaveNotes = async (callId: string, type: 'team' | 'sponsor', notes: string) => {
    setSavingNotes((prev) => ({ ...prev, [callId]: type }))
    try {
      const body = type === 'team' ? { summary_text: notes } : { client_notes: notes }
      const res = await fetch(`/api/calls/${callId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ['deal', dealId] })
      } else {
        toast.error('Failed to save notes')
      }
    } catch {
      toast.error('Failed to save notes')
    } finally {
      setSavingNotes((prev) => ({ ...prev, [callId]: null }))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!deal) {
    return (
      <EmptyState
        icon={Building2}
        title="Deal not found"
        description="This deal may have been removed or you may not have access to it."
        action={{ label: 'Back to Call Queue', onClick: () => router.push(`/projects/${projectId}/calls`) }}
      />
    )
  }

  const dealFields = deal.deal_fields ?? []
  const addrField = dealFields.find((f) => f.field_definitions?.key === 'address')
  const propertyName = addrField?.value ?? 'Untitled Deal'

  const unitsField = dealFields.find((f) => f.field_definitions?.key === 'unit_count')
  const unitCount = unitsField?.value ? parseInt(unitsField.value, 10) : null
  const unitText = unitCount ? `${unitCount} unit${unitCount === 1 ? '' : 's'}` : null

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: 'Projects', href: '/projects' },
          { label: projectName, href: `/projects/${projectId}/calls` },
          { label: 'Call Queue', href: `/projects/${projectId}/calls` },
          { label: propertyName },
        ]}
      />

      {/* Header Row */}
      <div className="flex items-center gap-3 pb-4 border-b border-[var(--color-surface-2)]">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/projects/${projectId}/calls`)}
          className="h-9 w-9 p-0 rounded-lg hover:bg-[var(--color-surface-2)]"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold leading-none text-[var(--color-text-primary)]">
              {propertyName}
            </h1>
            <Badge variant={stageVariant[deal.stage] ?? 'neutral'} size="sm" className="font-semibold">
              {deal.stage.replace(/_/g, ' ')}
            </Badge>
            <DealScoreBadge score={deal.score} />
          </div>
          {unitText && (
            <p className="text-xs text-[var(--color-text-tertiary)] mt-1.5 font-medium inline-flex items-center gap-1">
              <Building2 size={12} />
              {unitText}
            </p>
          )}
        </div>
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Call History Feed (2/3 width) */}
        <div className="lg:col-span-2 space-y-4">
          <div
            className="rounded-xl border p-5 bg-[var(--color-surface-0)] border-[var(--color-surface-2)] shadow-xs"
          >
            <h3 className="text-xs font-bold uppercase tracking-[0.03em] text-[var(--color-text-primary)] mb-4 pb-2 border-b border-[var(--color-surface-2)] flex items-center gap-1.5">
              <Phone className="h-4 w-4 text-[var(--color-accent)]" />
              Outreach Log & Call History
            </h3>
            
            {!deal.call_briefs?.length ? (
              <EmptyState
                icon={Phone}
                title="No call requests yet"
                description="Your team has not requested a follow-up call for this deal."
              />
            ) : (
              <div className="space-y-3">
                {deal.call_briefs.map((cb) => {
                  const isExpanded = expandedCallIds.has(cb.id)
                  return (
                    <div
                      key={cb.id}
                      className={`rounded-xl border bg-[var(--color-surface-0)] border-[var(--color-surface-2)] shadow-xs transition-colors hover:border-[var(--color-surface-3)] overflow-hidden ${
                        cb.id === activeCallId ? 'animate-card-flash' : ''
                      }`}
                    >
                      {/* Collapsed Header Clickable Bar */}
                      <div 
                        onClick={() => toggleExpandCall(cb.id)}
                        className="flex items-center justify-between p-4 cursor-pointer select-none bg-[var(--color-surface-0)] hover:bg-[var(--color-surface-1)] transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-wrap">
                          <Badge variant={statusVariant[cb.call_status] ?? 'warning'} size="sm" className="font-semibold">
                            {cb.call_status}
                          </Badge>
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
                            onClick={() => toggleExpandCall(cb.id)}
                            className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] p-0.5 focus:outline-none cursor-pointer"
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </div>
                      </div>

                      {/* Expanded Card Details */}
                      {isExpanded && (
                        <div className="p-4 border-t border-[var(--color-surface-2)] bg-[var(--color-surface-0)] space-y-4">
                          {/* Status Select Controller */}
                          <div className="flex items-center justify-between pb-3 border-b border-[var(--color-surface-2)] pt-4 flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold text-[var(--color-text-secondary)]">Call Status:</span>
                              <select
                                value={cb.call_status}
                                onChange={(e) => handleUpdateStatus(cb.id, e.target.value)}
                                className="text-[12px] border rounded-lg px-2.5 py-1 font-semibold outline-none cursor-pointer bg-[var(--color-surface-1)] border-[var(--color-surface-3)] text-[var(--color-text-primary)]"
                              >
                                <option value="pending">Pending</option>
                                <option value="completed">Completed</option>
                                <option value="cancelled">Cancelled</option>
                              </select>
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
                                    await handleSaveNotes(cb.id, 'team', val)
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
                                <MessageSquare size={11.5} className="text-[var(--color-accent)]" /> Note Left by Sponsor (Discussed Summary)
                              </span>
                              <textarea
                                defaultValue={cb.client_notes ?? ''}
                                onBlur={async (e) => {
                                  const val = e.target.value
                                  if (val !== (cb.client_notes ?? '')) {
                                    await handleSaveNotes(cb.id, 'sponsor', val)
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
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Property Specifications Card (1/3 width) */}
        {deal.deal_fields && deal.deal_fields.length > 0 && (
          <div
            className="rounded-xl border p-5 bg-[var(--color-surface-0)] border-[var(--color-surface-2)] shadow-xs space-y-4"
          >
            <h3 className="text-xs font-bold uppercase tracking-[0.03em] text-[var(--color-text-primary)] pb-2 border-b border-[var(--color-surface-2)] flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-[var(--color-accent)]" />
              Property Specifications
            </h3>
            
            <div className="space-y-3">
              {deal.deal_fields
                .filter((f) => f.field_definitions?.key !== 'address') // Hide address since it is in header
                .map((f) => (
                  <div 
                    key={f.field_definitions?.key} 
                    className="flex justify-between py-1.5 border-b border-[var(--color-surface-2)] text-[12px] gap-2 items-baseline"
                  >
                    <span className="text-[var(--color-text-tertiary)] font-medium">
                      {f.field_definitions?.label ?? f.field_definitions?.key}
                    </span>
                    <span 
                      className={`font-semibold text-right ${
                        f.field_definitions?.data_type === 'number' || 
                        f.field_definitions?.data_type === 'integer' || 
                        f.field_definitions?.data_type === 'currency'
                          ? 'font-mono'
                          : ''
                      } text-[var(--color-text-primary)]`}
                    >
                      {f.field_definitions?.data_type === 'currency' && f.value
                        ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(f.value))
                        : f.value ?? '—'}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
