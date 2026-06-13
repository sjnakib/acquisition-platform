'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/shared/PageHeader'
import type { BreadcrumbItem } from '@/components/shared/Breadcrumb'
import { pageHeadings } from '@/lib/page-headings'
import { DataGrid, type ColumnDef } from '@/components/shared/DataGrid'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PhoneCall, CheckCircle2, Award, Calendar, User, MessageSquare, Clock, Building2, Eye, PhoneOff } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface Call {
  id: string
  deal_id: string
  call_status: string
  summary_text: string | null
  client_notes: string | null
  contact_name: string | null
  contact_role: string | null
  phone_number: string | null
  flagged_at: string
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
  const queryClient = useQueryClient()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)

  const { data: calls = [], isLoading: loading } = useQuery<Call[]>({
    queryKey: ['call-queue', projectId ?? 'global'],
    queryFn: async () => {
      const url = projectId
        ? `/api/calls?project_id=${projectId}`
        : '/api/calls'
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to load calls')
      const data = await res.json()
      return Array.isArray(data) ? data : []
    },
  })

  // Stats Calculations (always base on all loaded calls)
  const pendingCalls = calls.filter((c) => c.call_status === 'pending').length
  const completedCalls = calls.filter((c) => c.call_status === 'completed').length
  const cancelledCalls = calls.filter((c) => c.call_status === 'cancelled').length

  // Client-side filtering & search
  const filteredCalls = useMemo(() => {
    return calls.filter((c) => {
      // 1. Status Filter
      if (statusFilter && c.call_status !== statusFilter) return false

      // 2. Search query
      if (search.trim()) {
        const query = search.toLowerCase()
        const address = getDealField(c.deals, 'address').toLowerCase()
        const name = (c.contact_name ?? '').toLowerCase()
        const role = (c.contact_role ?? '').toLowerCase()
        const phone = (c.phone_number ?? '').toLowerCase()
        return address.includes(query) || name.includes(query) || role.includes(query) || phone.includes(query)
      }

      return true
    })
  }, [calls, statusFilter, search])

  const columns: ColumnDef<Call>[] = [
    { key: 'address', header: 'Property Address', minWidth: 200, sortable: true, isRequired: true,
      accessor: (r) => getDealField(r.deals, 'address'),
      render: (r) => {
        const addressText = getDealField(r.deals, 'address') || 'Untitled'
        const dealProjectId = r.deals?.project_id || projectId
        return (
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (dealProjectId) {
                router.push(`/projects/${dealProjectId}/deals/${r.deal_id}`)
              }
            }}
            className="group flex items-center gap-1.5 font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-accent)] transition-colors text-left focus:outline-none cursor-pointer py-1"
          >
            <Building2 className="h-3.5 w-3.5 text-[var(--color-text-tertiary)] group-hover:text-[var(--color-accent)] transition-colors flex-shrink-0" />
            <span className="hover:underline">{addressText}</span>
          </button>
        )
      }
    },
    { key: 'units', header: 'Units', width: 90, sortable: true, isRequired: true,
      accessor: (r) => getDealField(r.deals, 'unit_count'),
      render: (r) => {
        const units = getDealField(r.deals, 'unit_count')
        return <span className="font-mono text-[var(--color-text-secondary)]">{units || '—'}</span>
      }
    },
    { key: 'contact_name', header: 'Contact Name', width: 160, sortable: true,
      accessor: (r) => r.contact_name ?? '',
      render: (r) => <span className="font-semibold text-[var(--color-text-primary)]">{r.contact_name || '—'}</span>
    },
    { key: 'contact_role', header: 'Title / Designation', minWidth: 150, sortable: true,
      accessor: (r) => r.contact_role ?? '',
      render: (r) => <span className="text-[var(--color-text-secondary)]">{r.contact_role || '—'}</span>
    },
    { key: 'phone_number', header: 'Phone Number', width: 140,
      accessor: (r) => r.phone_number ?? '',
      render: (r) => r.phone_number ? (
        <a href={`tel:${r.phone_number}`} className="font-mono text-[var(--color-accent)] font-semibold hover:underline" onClick={(e) => e.stopPropagation()}>{r.phone_number}</a>
      ) : (
        <span className="text-[var(--color-text-tertiary)]">—</span>
      )
    },
    { key: 'flagged_at', header: 'Request Created', width: 130, sortable: true,
      accessor: (r) => r.flagged_at,
      render: (r) => (
        <span className="font-semibold font-mono text-[var(--color-text-secondary)] text-[12px] inline-flex items-center gap-1.5 py-1">
          <Calendar size={12} className="text-[var(--color-text-tertiary)]" />
          {formatDate(r.flagged_at)}
        </span>
      )
    },
    { key: 'call_status', header: 'Status', width: 120, sortable: true,
      accessor: (r) => r.call_status,
      render: (r) => (
        <select
          value={r.call_status}
          onChange={async (e) => {
            const status = e.target.value
            const res = await fetch(`/api/calls/${r.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ call_status: status }) })
            if (res.ok) {
              toast.success('Call status updated')
              queryClient.invalidateQueries({ queryKey: ['call-queue', projectId ?? 'global'] })
            } else {
              toast.error('Failed to update call status')
            }
          }}
          onClick={(e) => e.stopPropagation()}
          className="text-[12px] border rounded-lg px-2.5 py-1 font-semibold outline-none transition-all cursor-pointer"
          style={{
            borderColor: r.call_status === 'pending' ? 'var(--color-warning-border)' : r.call_status === 'completed' ? 'var(--color-success-border)' : 'var(--color-surface-3)',
            background: r.call_status === 'pending' ? 'var(--color-warning-bg)' : r.call_status === 'completed' ? 'var(--color-success-bg)' : 'var(--color-surface-1)',
            color: r.call_status === 'pending' ? 'var(--color-warning-text)' : r.call_status === 'completed' ? 'var(--color-success-text)' : 'var(--color-text-secondary)',
          }}
        >
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      ),
    },
    { key: 'actions', header: '', width: 95, align: 'center',
      render: (r) => {
        if (!onRowClick) return null
        return (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRowClick(r)
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-[var(--color-surface-3)] bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-all cursor-pointer shadow-2xs focus:outline-none"
            title="View Details"
          >
            <Eye className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
            Details
          </button>
        )
      }
    },
  ]

  return (
    <div className="flex flex-col gap-5" style={{ height: 'calc(100vh - 64px)' }}>
      <PageHeader title={pageHeadings.callQueue.title} description={pageHeadings.callQueue.description} breadcrumb={breadcrumb} />
      
      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Pending Card */}
        <div className="rounded-xl border p-4 bg-[var(--color-surface-0)] border-[var(--color-surface-2)] shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)] text-[var(--color-warning-text)]">
            <PhoneCall className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.03em] text-[var(--color-text-tertiary)] block">
              Pending Outreach
            </span>
            <p className="text-[16px] font-bold font-mono text-[var(--color-text-primary)] mt-0.5">
              {pendingCalls} call{pendingCalls === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        {/* Completed Card */}
        <div className="rounded-xl border p-4 bg-[var(--color-surface-0)] border-[var(--color-surface-2)] shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--color-success-bg)] border border-[var(--color-success-border)] text-[var(--color-success-text)]">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.03em] text-[var(--color-text-tertiary)] block">
              Completed Outreach
            </span>
            <p className="text-[16px] font-bold font-mono text-[var(--color-text-primary)] mt-0.5">
              {completedCalls} call{completedCalls === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        {/* Cancelled Card */}
        <div className="rounded-xl border p-4 bg-[var(--color-surface-0)] border-[var(--color-surface-2)] shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[rgba(220,53,69,0.08)] border border-[rgba(220,53,69,0.15)] text-[var(--color-danger-text)]">
            <PhoneOff className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.03em] text-[var(--color-text-tertiary)] block">
              Cancelled Outreach
            </span>
            <p className="text-[16px] font-bold font-mono text-[var(--color-text-primary)] mt-0.5">
              {cancelledCalls} call{cancelledCalls === 1 ? '' : 's'}
            </p>
          </div>
        </div>
      </div>

      {/* DataGrid Container */}
      <div className="flex-1 min-h-0">
        <DataGrid
          columns={columns}
          data={filteredCalls}
          rowKey={(r) => r.id}
          loading={loading}
          emptyMessage="No calls queued yet — your team will notify you."
          fillHeight
          onRowClick={onRowClick}
          topToolbar={{
            recordLabel: 'call',
            searchValue: search,
            onSearchChange: setSearch,
            searchPlaceholder: 'Search address, contact, role...',
          }}
          filters={[
            {
              id: 'status',
              label: 'Status',
              options: [
                { value: 'pending', label: 'Pending' },
                { value: 'completed', label: 'Completed' },
                { value: 'cancelled', label: 'Cancelled' },
              ],
              value: statusFilter,
              onChange: (val) => setStatusFilter(val),
            },
          ]}
          onClearFilters={() => setStatusFilter(null)}
        />
      </div>
    </div>
  )
}
