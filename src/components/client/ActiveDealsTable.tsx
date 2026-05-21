'use client'

import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import type { BreadcrumbItem } from '@/components/shared/Breadcrumb'
import { pageHeadings } from '@/lib/page-headings'
import { DataGrid, type ColumnDef } from '@/components/shared/DataGrid'
import { Badge } from '@/components/ui/badge'

interface Deal {
  id: string
  deal_name: string | null
  unit_count: number | null
  score: string | null
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
  { key: 'deal_name', header: 'Property Name', minWidth: 160, sortable: true,
    render: (r) => <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{r.deal_name ?? 'Untitled'}</span> },
  { key: 'unit_count', header: 'Units', align: 'right', width: 80, sortable: true,
    render: (r) => <span className="tabular-nums" style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>{r.unit_count ?? '—'}</span> },
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
    <div>
      <PageHeader title={pageHeadings.activeDeals.title} description={pageHeadings.activeDeals.description} breadcrumb={breadcrumb} />
      <DataGrid
        columns={columns}
        data={deals}
        rowKey={(r) => r.id}
        loading={loading}
        emptyMessage="No active deals yet — your team will notify you when deals are ready."
        maxHeight="calc(100vh - 230px)"
      />
    </div>
  )
}
