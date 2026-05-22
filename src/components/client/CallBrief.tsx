import { Badge } from '@/components/ui/badge'

interface CallBriefProps {
  brief: {
    id: string
    summary_text: string | null
    published: boolean
    call_status: string
    client_notes: string | null
    deals?: {
      score: string | null
      deal_fields?: { value: string | null; field_definitions: { key: string; label: string; data_type: string } | null }[] | null
    }
  }
  onUpdate?: (id: string, data: Record<string, unknown>) => void
}

const statusVariant: Record<string, 'success' | 'danger' | 'warning'> = {
  completed: 'success',
  cancelled: 'danger',
  pending: 'warning',
}

function getDealName(deal: CallBriefProps['brief']['deals']): string {
  const f = deal?.deal_fields?.find((df) => df?.field_definitions?.key === 'deal_name')
  return f?.value ?? 'Deal'
}

export function CallBrief({ brief }: CallBriefProps) {
  return (
    <div className="rounded-xl border p-5" style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-surface-2)', boxShadow: 'var(--shadow-xs)' }}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans)' }}>{getDealName(brief.deals)}</h3>
        </div>
        <Badge variant={statusVariant[brief.call_status] ?? 'neutral'} size="sm">{brief.call_status}</Badge>
      </div>
      <p className="text-sm mb-3" style={{ color: 'var(--color-text-secondary)' }}>{brief.summary_text || 'No summary available.'}</p>
      {brief.client_notes && (
        <div className="rounded p-3 text-sm" style={{ background: 'var(--color-surface-1)', color: 'var(--color-text-secondary)' }}>
          <span className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-tertiary)' }}>Client Notes:</span>
          {brief.client_notes}
        </div>
      )}
    </div>
  )
}
