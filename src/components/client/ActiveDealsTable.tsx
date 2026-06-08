'use client'

import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import type { BreadcrumbItem } from '@/components/shared/Breadcrumb'
import { pageHeadings } from '@/lib/page-headings'
import { DataGrid, type ColumnDef } from '@/components/shared/DataGrid'
import { Badge } from '@/components/ui/badge'

interface Deal {
  id: string
  score: string | null
  outreach_emails: string[] | null
  deal_fields?: { value: string | null; field_definitions: { key: string; label: string; data_type: string } | null }[] | null
}

function getDealField(deal: Deal, key: string): string {
  const f = deal.deal_fields?.find((df) => df?.field_definitions?.key === key)
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

const columns: ColumnDef<Deal>[] = [
  { key: 'address', header: 'Property Address', minWidth: 160, sortable: true, isRequired: true,
    render: (r) => <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{getDealField(r, 'address') || 'Untitled'}</span> },
  { key: 'unit_count', header: 'Units', align: 'right', width: 80, sortable: true, isRequired: true,
    render: (r) => <span className="tabular-nums" style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>{getDealField(r, 'unit_count') || '—'}</span> },
  { key: 'outreach_emails', header: 'Email Targets', minWidth: 160, sortable: false, isRequired: true,
    accessor: (r) => (r.outreach_emails ?? []).join(', '),
    render: (r) => {
      const emails = r.outreach_emails
      if (!emails || emails.length === 0) return <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
      const count = emails.length
      const shown = emails.slice(0, 2).join(', ')
      const remainder = count > 2 ? ` +${count - 2} more` : ''
      return (
        <span className="text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
          {shown}
          {remainder && <span style={{ color: 'var(--color-text-tertiary)' }}>{remainder}</span>}
        </span>
      )
    },
  },
  { key: 'score', header: 'Score', width: 110, sortable: true,
    render: (r) => {
      if (!r.score) return <Badge variant="neutral">Unscored</Badge>
      const v = scoreVariant[r.score]
      if (!v) return <Badge variant="neutral">{r.score}</Badge>
      return <Badge variant={v}>{scoreLabel[r.score] ?? r.score}</Badge>
    },
  },
]

export default function ActiveDealsTable({ projectId, breadcrumb }: { projectId?: string; breadcrumb?: BreadcrumbItem[] }) {
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const url = projectId
      ? `/api/deals?limit=1000&project_id=${projectId}`
      : '/api/deals?limit=1000'
    fetch(url)
      .then((r) => r.json())
      .then((json) => setDeals(json.data ?? []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [projectId])

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      <PageHeader title={pageHeadings.activeDeals.title} description={pageHeadings.activeDeals.description} breadcrumb={breadcrumb} />
      <div className="flex-1 min-h-0">
        <DataGrid
          columns={columns}
          data={deals}
          rowKey={(r) => r.id}
          loading={loading}
          emptyMessage="No active deals yet — your team will notify you when deals are ready."
          fillHeight
        />
      </div>
    </div>
  )
}
