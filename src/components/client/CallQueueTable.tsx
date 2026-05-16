'use client'

import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { pageHeadings } from '@/lib/page-headings'
import { DataGrid, type ColumnDef } from '@/components/shared/DataGrid'
import { Badge } from '@/components/ui/badge'

interface Call {
  id: string
  call_status: string
  summary_text: string | null
  deals: {
    deal_name: string | null
    address: string | null
    city: string | null
    state: string | null
    score: string | null
  } | null
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

export default function CallQueueTable() {
  const [calls, setCalls] = useState<Call[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/calls')
      .then((r) => r.json())
      .then((data) => setCalls(data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const columns: ColumnDef<Call>[] = [
    { key: 'deal_name', header: 'Property', minWidth: 160, sortable: true,
      accessor: (r) => r.deals?.deal_name ?? '',
      render: (r) => <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{r.deals?.deal_name ?? 'Untitled'}</span> },
    { key: 'address', header: 'Address', minWidth: 160, sortable: true,
      accessor: (r) => [r.deals?.address, r.deals?.city, r.deals?.state].filter(Boolean).join(', '),
      render: (r) => <span style={{ color: 'var(--color-text-secondary)' }}>{[r.deals?.address, r.deals?.city, r.deals?.state].filter(Boolean).join(', ') || '—'}</span> },
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
    { key: 'call_status', header: 'Status', width: 120, sortable: true,
      render: (r) => (
        <select
          value={r.call_status}
          onChange={async (e) => {
            const status = e.target.value
            await fetch(`/api/calls/${r.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ call_status: status }) })
            window.location.reload()
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
    <div>
      <PageHeader title={pageHeadings.callQueue.title} description={pageHeadings.callQueue.description} />
      <DataGrid
        columns={columns}
        data={calls}
        rowKey={(r) => r.id}
        loading={loading}
        emptyMessage="No calls queued yet — your team will notify you."
        maxHeight="calc(100vh - 230px)"
      />
    </div>
  )
}
