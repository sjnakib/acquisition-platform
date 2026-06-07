'use client'

import { useState, useEffect, useCallback } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import type { BreadcrumbItem } from '@/components/shared/Breadcrumb'
import { pageHeadings } from '@/lib/page-headings'
import { DataGrid, type ColumnDef } from '@/components/shared/DataGrid'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface Call {
  id: string
  deal_id: string
  call_status: string
  summary_text: string | null
  client_notes: string | null
  contact_name: string | null
  contact_role: string | null
  phone_number: string | null
  deals: {
    score: string | null
    project_id: string
    deal_fields?: { value: string | null; field_definitions: { key: string; label: string; data_type: string } | null }[] | null
  } | null
}

function getDealField(deal: Call['deals'], key: string): string {
  const f = deal?.deal_fields?.find((df) => df?.field_definitions?.key === key)
  return f?.value ?? ''
}

const scoreVariant: Record<string, 'score-vg' | 'score-g' | 'score-b' | 'score-vb'> = {
  very_good: 'score-vg',
  good: 'score-g',
  bad: 'score-b',
  very_bad: 'score-vb',
}

const scoreLabel: Record<string, string> = {
  very_good: 'Very Good',
  good: 'Good',
  bad: 'Bad',
  very_bad: 'Very Bad',
}

export default function CallQueueTable({ projectId, breadcrumb, onRowClick }: { projectId?: string; breadcrumb?: BreadcrumbItem[]; onRowClick?: (row: Call) => void }) {
  const [calls, setCalls] = useState<Call[]>([])
  const [loading, setLoading] = useState(true)
  const [savingNotes, setSavingNotes] = useState<Set<string>>(new Set())

  useEffect(() => {
    const url = projectId
      ? `/api/calls?project_id=${projectId}`
      : '/api/calls'
    fetch(url)
      .then((r) => r.json())
      .then((data) => setCalls(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [projectId])

  const saveNotes = useCallback(async (callId: string, notes: string) => {
    setSavingNotes((prev) => new Set(prev).add(callId))
    try {
      const res = await fetch(`/api/calls/${callId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_notes: notes }),
      })
      if (!res.ok) {
        toast.error('Failed to save notes')
      }
    } catch {
      toast.error('Failed to save notes')
    } finally {
      setSavingNotes((prev) => {
        const next = new Set(prev)
        next.delete(callId)
        return next
      })
    }
  }, [])

  const columns: ColumnDef<Call>[] = [
    { key: 'address', header: 'Property Address', minWidth: 160, sortable: true,
      accessor: (r) => getDealField(r.deals, 'address'),
      render: (r) => <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{getDealField(r.deals, 'address') || 'Untitled'}</span> },
    { key: 'score', header: 'Score', width: 110, sortable: true,
      accessor: (r) => r.deals?.score ?? '',
      render: (r) => {
        const s = r.deals?.score
        if (!s) return <Badge variant="neutral">—</Badge>
        const v = scoreVariant[s]
        if (!v) return <Badge variant="neutral">{s}</Badge>
        return <Badge variant={v}>{scoreLabel[s] ?? s}</Badge>
      }},
    { key: 'summary_text', header: 'Summary', minWidth: 200, sortable: true,
      render: (r) => <span className="text-xs line-clamp-2" style={{ color: 'var(--color-text-secondary)' }}>{r.summary_text || 'No summary available.'}</span> },
    { key: 'contact', header: 'Contact', width: 150,
      render: (r) => {
        if (!r.contact_name) return <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>—</span>
        return (
          <div className="text-xs">
            <span style={{ color: 'var(--color-text-primary)' }}>{r.contact_name}</span>
            {r.contact_role && (
              <span className="block text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>{r.contact_role}</span>
            )}
          </div>
        )
      },
    },
    { key: 'client_notes', header: 'Your Notes', minWidth: 180,
      render: (r) => {
        const isSaving = savingNotes.has(r.id)
        return (
          <div className="relative">
            <textarea
              defaultValue={r.client_notes ?? ''}
              onBlur={async (e) => {
                const val = e.target.value
                if (val !== (r.client_notes ?? '')) {
                  setCalls((prev) => prev.map((c) => c.id === r.id ? { ...c, client_notes: val } : c))
                  await saveNotes(r.id, val)
                }
              }}
              placeholder="Add notes..."
              rows={2}
              className="w-full text-xs rounded border px-2 py-1 resize-none outline-none focus:ring-1 focus:ring-[var(--accent)]"
              style={{
                background: 'var(--color-surface-1)',
                borderColor: 'var(--color-surface-3)',
                color: 'var(--color-text-primary)',
              }}
              onClick={(e) => e.stopPropagation()}
              disabled={isSaving}
            />
            {isSaving && (
              <span className="absolute right-2 top-1 text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>Saving...</span>
            )}
          </div>
        )
      },
    },
    { key: 'call_status', header: 'Status', width: 120, sortable: true,
      render: (r) => (
        <select
          value={r.call_status}
          onChange={async (e) => {
            const status = e.target.value
            const res = await fetch(`/api/calls/${r.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ call_status: status }) })
            if (res.ok) {
              toast.success('Call status updated')
              setCalls((prev) => prev.map((c) => c.id === r.id ? { ...c, call_status: status } : c))
            } else {
              toast.error('Failed to update call status')
            }
          }}
          onClick={(e) => e.stopPropagation()}
          className="text-xs border rounded px-2 py-0.5 font-medium outline-none"
          style={{
            borderColor: r.call_status === 'pending' ? 'var(--color-warning-border)' : r.call_status === 'completed' ? 'var(--color-success-border)' : 'var(--color-surface-3)',
            background: r.call_status === 'pending' ? 'var(--color-warning-bg)' : r.call_status === 'completed' ? 'var(--color-success-bg)' : 'var(--color-neutral-bg)',
            color: r.call_status === 'pending' ? 'var(--color-warning-text)' : r.call_status === 'completed' ? 'var(--color-success-text)' : 'var(--color-neutral-text)',
          }}
        >
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      ),
    },
  ]

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      <PageHeader title={pageHeadings.callQueue.title} description={pageHeadings.callQueue.description} breadcrumb={breadcrumb} />
      <div className="flex-1 min-h-0">
        <DataGrid
          columns={columns}
          data={calls}
          rowKey={(r) => r.id}
          loading={loading}
          emptyMessage="No calls queued yet — your team will notify you."
          fillHeight
          onRowClick={onRowClick}
        />
      </div>
    </div>
  )
}
