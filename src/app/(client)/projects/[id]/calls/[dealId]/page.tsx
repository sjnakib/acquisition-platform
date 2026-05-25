'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Building2, Phone, FileText } from 'lucide-react'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { Breadcrumb } from '@/components/shared/Breadcrumb'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useProjectContext } from '@/components/shared/ProjectContext'
import { DealScoreBadge } from '@/components/deals/DealScoreBadge'
import { formatDate } from '@/lib/utils'

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
  deal_name: string | null
  unit_count: number | null
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
  const [deal, setDeal] = useState<DealDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!dealId) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setLoading(true)
    }, 0)
    fetch(`/api/deals/${dealId}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => setDeal(data))
      .catch((err) => { if (err.name !== 'AbortError') console.error(err) })
      .finally(() => setLoading(false))
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [dealId])

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

  const propertyName = deal.deal_name ?? 'Untitled Deal'
  const unitText = deal.unit_count ? `${deal.unit_count} unit${deal.unit_count === 1 ? '' : 's'}` : null

  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'Projects', href: '/projects' },
          { label: projectName, href: `/projects/${projectId}/calls` },
          { label: 'Call Queue', href: `/projects/${projectId}/calls` },
          { label: propertyName },
        ]}
      />

      <div className="flex items-center gap-3 mb-6 mt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/projects/${projectId}/calls`)}
          className="h-8 w-8 p-0"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              {propertyName}
            </h1>
            <Badge variant={stageVariant[deal.stage] ?? 'neutral'} size="sm">
              {deal.stage.replace(/_/g, ' ')}
            </Badge>
            <DealScoreBadge score={deal.score} />
          </div>
          {unitText && (
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{unitText}</p>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {/* Property Details */}
        {deal.deal_fields && deal.deal_fields.length > 0 && (
          <div
            className="rounded-xl border p-5"
            style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-border)' }}
          >
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
              Property Details
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {deal.deal_fields.map((f) => (
                <div key={f.field_definitions?.key}>
                  <span className="text-xs block mb-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                    {f.field_definitions?.label ?? f.field_definitions?.key}
                  </span>
                  <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {f.value ?? '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Call Briefs */}
        <div
          className="rounded-xl border p-5"
          style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-border)' }}
        >
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
            Call History
          </h3>
          {!deal.call_briefs?.length ? (
            <EmptyState
              icon={Phone}
              title="No call requests yet"
              description="Your team has not yet requested a follow-up call for this deal."
            />
          ) : (
            <div className="space-y-3">
              {deal.call_briefs.map((cb) => (
                <div
                  key={cb.id}
                  className="rounded-lg border p-4"
                  style={{ background: 'var(--color-surface-1)', borderColor: 'var(--color-border)' }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <Badge variant={statusVariant[cb.call_status] ?? 'warning'} size="sm">
                      {cb.call_status}
                    </Badge>
                    <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                      {formatDate(cb.flagged_at)}
                    </span>
                  </div>

                  {(cb.contact_name || cb.contact_role || cb.phone_number) && (
                    <p className="text-[13px] mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
                      {[cb.contact_name, cb.contact_role, cb.phone_number].filter(Boolean).join(' · ')}
                    </p>
                  )}

                  <div className="flex items-start gap-2 mb-3">
                    <FileText className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
                    <p className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
                      {cb.summary_text || 'No call notes.'}
                    </p>
                  </div>

                  {cb.client_notes && (
                    <div
                      className="rounded-lg p-3 text-[13px]"
                      style={{ background: 'var(--color-surface-0)', color: 'var(--color-text-secondary)' }}
                    >
                      <span className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-tertiary)' }}>
                        Your Notes:
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
    </div>
  )
}
