'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Mail, Target, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DealTable, type Deal } from '@/components/deals/DealTable'
import { DeleteDealDialog } from '@/components/deals/DeleteDealDialog'
import { batchDeleteDeals, deleteAllDeals } from '@/lib/batch-delete'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmailTemplateManager } from '@/components/campaigns/EmailTemplateManager'
import { Tooltip } from '@/components/ui/tooltip'
import { toast } from 'sonner'

interface Campaign {
  id: string; name: string; market: string; listing_type: string | null
  email_template: string | null; email_template_id: string | null
  email_subject_template: string | null; email_body_template: string | null
  project_id: string | null
  target_response_rate_pct: number | null; target_loi_count: number | null
  is_active: boolean; created_at: string
}

interface FieldDef {
  id: string; key: string; label: string; data_type: string
  show_in_grid: boolean; sort_order: number; source?: string | null
}

const STAGE_ORDER = ['lead', 'outreach', 'response', 'underwriting', 'loi', 'closed', 'failed', 'archived'] as const
const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead', outreach: 'Outreach', response: 'Response',
  underwriting: 'Underwriting', loi: 'LOI', closed: 'Closed',
  failed: 'Failed', archived: 'Archived',
}

const tabTriggerStyle = (active: boolean, disabled?: boolean) =>
  ({
    padding: '6px 14px',
    fontSize: 13,
    fontWeight: 500,
    fontFamily: 'var(--font-dm-sans)',
    color: disabled ? 'var(--color-text-tertiary)' : active ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
    borderBottom: active && !disabled ? '2px solid var(--accent)' : '2px solid transparent',
    background: 'transparent',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'color 150ms ease, border-color 150ms ease',
  }) as const

const sectionStyle = {
  background: 'var(--color-surface-0)',
  border: '1px solid var(--color-surface-2)',
  borderRadius: 'var(--radius-lg)',
  padding: 20,
} as const

const sectionTitleStyle = {
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--color-text-tertiary)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
  marginBottom: 16,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
} as const

const labelStyle = {
  fontSize: 12,
  color: 'var(--color-text-tertiary)',
  marginBottom: 2,
} as const

const valueStyle = {
  fontSize: 14,
  color: 'var(--color-text-primary)',
  fontWeight: 500,
} as const

const mutedStyle = {
  fontSize: 13,
  color: 'var(--color-text-secondary)',
} as const

function StageBar({ deals }: { deals: Pick<Deal, 'stage'>[] }) {
  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const d of deals) {
      map.set(d.stage, (map.get(d.stage) ?? 0) + 1)
    }
    return map
  }, [deals])

  const total = deals.length
  const maxCount = Math.max(1, ...counts.values())

  return (
    <div className="space-y-2">
      {STAGE_ORDER.map((stage) => {
        const count = counts.get(stage) ?? 0
        const pct = total > 0 ? Math.round((count / total) * 100) : 0
        const barPct = Math.round((count / maxCount) * 100)
        return (
          <div key={stage} className="flex items-center gap-3">
            <span style={{ width: 90, fontSize: 12, color: 'var(--color-text-secondary)', textAlign: 'right' as const }}>
              {STAGE_LABELS[stage] ?? stage}
            </span>
            <div className="flex-1 h-[18px] rounded-sm relative" style={{ background: 'var(--color-surface-1)' }}>
              {count > 0 && (
                <div
                  className="h-full rounded-sm absolute left-0 top-0 transition-all duration-300"
                  style={{ width: `${barPct}%`, background: 'var(--accent)', opacity: 0.7 }}
                />
              )}
            </div>
            <span style={{ width: 48, fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-jetbrains-mono)' }}>
              {count > 0 ? <><span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{count}</span> <span style={{ color: 'var(--color-text-tertiary)' }}>{pct}%</span></> : <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function CampaignDetailPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'details' | 'leads'>('leads')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([])
  const [allSelected, setAllSelected] = useState(false)
  const [gridKey, setGridKey] = useState(0)

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(null)
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(search), 300)
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current) }
  }, [search])

  const { data: campaign, isLoading: campaignLoading } = useQuery<Campaign>({
    queryKey: ['campaigns', id],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${encodeURIComponent(id)}`)
      if (!res.ok) throw new Error('Failed to fetch campaign')
      return res.json()
    },
  })

  const { data: dealsData, isLoading: dealsLoading } = useQuery<{ data: Deal[]; total: number }>({
    queryKey: ['deals', { campaign_id: id, page, pageSize, search: debouncedSearch, sort: sortKey, order: sortDir }],
    queryFn: async () => {
      const offset = (page - 1) * pageSize
      const params = new URLSearchParams({
        campaign_id: id, limit: String(pageSize), offset: String(offset),
        sort: sortKey, order: sortDir,
      })
      if (debouncedSearch) params.set('search', debouncedSearch)
      const res = await fetch(`/api/deals?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch deals')
      return res.json()
    },
  })

  // Lightweight query for Details tab metrics — all deals for stage counts
  const { data: allDeals } = useQuery<Pick<Deal, 'stage' | 'deal_fields'>[]>({
    queryKey: ['deals', { campaign_id: id, select: 'stage' }],
    queryFn: async () => {
      const res = await fetch(`/api/deals?campaign_id=${encodeURIComponent(id)}&limit=1000`)
      if (!res.ok) throw new Error('Failed to fetch deal metrics')
      const json = await res.json()
      return (json.data ?? []) as Pick<Deal, 'stage' | 'deal_fields'>[]
    },
    enabled: tab === 'details',
  })

  const { data: fieldDefs = [] } = useQuery<FieldDef[]>({
    queryKey: ['field-definitions'],
    queryFn: async () => {
      const res = await fetch('/api/field-definitions')
      if (!res.ok) throw new Error('Failed to fetch field definitions')
      return res.json()
    },
  })

  // Gmail connection status — requires project_id from campaign
  const projectId = campaign?.project_id
  const { data: gmailConnected = false } = useQuery<boolean>({
    queryKey: ['project', projectId, 'gmail-status'],
    queryFn: async () => {
      if (!projectId) return false
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`)
      if (!res.ok) return false
      const json = await res.json()
      return !!json.google_connections?.google_email
    },
    enabled: !!projectId,
  })

  const handleCampaignUpdate = async (updates: Partial<Campaign>) => {
    try {
      const res = await fetch(`/api/campaigns/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error('Failed to update campaign')
      queryClient.invalidateQueries({ queryKey: ['campaigns', id] })
    } catch {
      toast.error('Failed to save template')
    }
  }

  const deals = dealsData?.data ?? []
  const total = dealsData?.total ?? 0
  const activeTab = total === 0 ? 'leads' : tab

  // Clamp page if sort/filter reduced total pages below current page
  useEffect(() => {
    if (deals.length === 0 && total > 0 && page > 1) {
      const maxPage = Math.ceil(total / pageSize)
      const timer = setTimeout(() => {
        setPage(Math.min(page, maxPage))
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [deals.length, total, page, pageSize])

  if (campaignLoading) {
    return <div className="flex justify-center py-20"><LoadingSpinner size="page" /></div>
  }

  if (!campaign) {
    return <div className="text-center py-20" style={{ color: 'var(--color-text-tertiary)' }}>Campaign not found.</div>
  }

  return (
    <div className="flex flex-col -mb-4" style={{ height: 'calc(100vh - 48px)' }}>
      {/* Header */}
      <div className="flex items-center gap-2 flex-shrink-0 mb-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/campaigns')} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1
          className="text-[17px] font-medium tracking-[-0.02em] truncate"
          style={{ fontFamily: 'var(--font-dm-sans)', color: 'var(--color-text-primary)' }}
        >
          {campaign.name}
        </h1>
        <Badge variant={campaign.is_active ? 'success' : 'neutral'} size="sm">
          {campaign.is_active ? 'Active' : 'Inactive'}
        </Badge>
        <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{campaign.market}</span>
        {campaign.listing_type && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', padding: '1px 8px',
            borderRadius: 'var(--radius-md)', background: 'var(--color-surface-1)',
            fontSize: 12, color: 'var(--color-text-secondary)',
          }}>
            {campaign.listing_type.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 flex-shrink-0 mb-4" style={{ borderBottom: '1px solid var(--color-surface-2)' }}>
        {total === 0 ? (
          <Tooltip content="Import leads first to enable mass emailing" position="bottom">
            <button
              style={tabTriggerStyle(activeTab === 'details', total === 0)}
              onClick={() => setTab('details')}
              disabled={total === 0}
            >
              Details
            </button>
          </Tooltip>
        ) : (
          <button
            style={tabTriggerStyle(activeTab === 'details', total === 0)}
            onClick={() => setTab('details')}
            disabled={total === 0}
          >
            Details
          </button>
        )}
        <button style={tabTriggerStyle(activeTab === 'leads')} onClick={() => setTab('leads')}>
          Leads{total > 0 ? ` (${total})` : ''}
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-auto">
        {activeTab === 'details' ? (
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            {/* Left 70% — Email Template Manager */}
            <div style={{ width: '70%', minWidth: 0 }}>
              {projectId ? (
                <EmailTemplateManager
                  campaign={campaign}
                  projectId={projectId}
                  leadsCount={total}
                  gmailConnected={gmailConnected}
                  onCampaignUpdate={handleCampaignUpdate}
                />
              ) : (
                <div style={sectionStyle}>
                  <div style={sectionTitleStyle}><Mail className="h-3.5 w-3.5" />Template Configuration</div>
                  <div style={mutedStyle}>Campaign must be associated with a project to manage email templates.</div>
                </div>
              )}
            </div>
            {/* Right 30% — Pipeline, Targets, Summary */}
            <div style={{ width: '30%', minWidth: 280, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={sectionStyle}>
                <div style={sectionTitleStyle}><BarChart3 className="h-3.5 w-3.5" />Pipeline by Stage</div>
                {total === 0 ? <div style={mutedStyle}>No deals in this campaign yet.</div> : <StageBar deals={allDeals ?? []} />}
              </div>
              <div style={sectionStyle}>
                <div style={sectionTitleStyle}><Target className="h-3.5 w-3.5" />Targets</div>
                {campaign.target_response_rate_pct != null || campaign.target_loi_count != null ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {campaign.target_response_rate_pct != null && <div><div style={labelStyle}>Response Rate</div><div style={valueStyle}>{campaign.target_response_rate_pct}%</div></div>}
                    {campaign.target_loi_count != null && <div><div style={labelStyle}>LOI Count</div><div style={valueStyle}>{campaign.target_loi_count}</div></div>}
                  </div>
                ) : <div style={mutedStyle}>No targets set.</div>}
              </div>
              <div style={sectionStyle}>
                <div style={{ ...sectionTitleStyle, marginBottom: 12 }}>Summary</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div><div style={labelStyle}>Total Deals</div><div style={valueStyle}>{total}</div></div>
                  <div><div style={labelStyle}>Total Units</div><div style={valueStyle}>{(allDeals ?? []).reduce((sum, d) => {
                    const uc = d.deal_fields?.find((f) => f?.field_definitions?.key === 'unit_count')
                    return sum + (uc?.value ? parseInt(uc.value, 10) || 0 : 0)
                  }, 0)}</div></div>
                  <div><div style={labelStyle}>Market</div><div style={valueStyle}>{campaign.market}</div></div>
                  <div><div style={labelStyle}>Listing Type</div><div style={valueStyle}>{campaign.listing_type?.replace(/_/g, ' ') ?? 'Any'}</div></div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col" style={{ height: '100%' }}>
            <div className="flex-1 min-h-0">
              <DealTable
                key={gridKey}
                deals={deals}
                loading={dealsLoading}
                fieldDefs={fieldDefs}
                emptyAction={{ label: 'Import Deals', onClick: () => router.push('/import') }}
                fillHeight
                totalRows={total}
                page={page}
                pageSize={pageSize}
                onPageChange={(p) => { setPage(p); setAllSelected(false) }}
                onPageSizeChange={(v) => { setPageSize(v); setPage(1); setAllSelected(false) }}
                allRowsSelected={allSelected}
                onSelectionChange={(ids) => { if (allSelected && ids.size === 0) setAllSelected(false) }}
                serverSide
                serverSortKey={sortKey}
                serverSortDir={sortDir}
                onSortChange={(key, dir) => { setSortKey(key); setSortDir(dir); setAllSelected(false) }}
                onSelectAll={() => setAllSelected(true)}
                topToolbar={{
                  recordLabel: 'deal',
                  onAdd: () => router.push('/import'),
                  onDelete: async (ids) => {
                    if (allSelected) {
                      setPendingDeleteIds([])
                      setDeleteOpen(true)
                    } else {
                      setPendingDeleteIds(Array.from(ids))
                      setDeleteOpen(true)
                    }
                  },
                  searchValue: search,
                  onSearchChange: setSearch,
                }}
              />
            </div>
          </div>
        )}
      </div>

      <DeleteDealDialog
        dealNames={pendingDeleteIds.map((id) => {
          const d = deals.find((d) => d.id === id)
          const df = d?.deal_fields?.find((f) => f?.field_definitions?.key === 'address')
          return df?.value ?? 'Untitled Deal'
        })}
        open={deleteOpen}
        allSelected={allSelected}
        totalCount={total}
        onOpenChange={(open) => {
          setDeleteOpen(open)
          if (!open) { setPendingDeleteIds([]); setAllSelected(false) }
        }}
        onConfirm={async () => {
          if (allSelected) {
            await deleteAllDeals({ campaign_id: id, search: debouncedSearch || undefined })
          } else {
            await batchDeleteDeals(pendingDeleteIds)
          }
          setGridKey((k) => k + 1)
          queryClient.invalidateQueries({ queryKey: ['deals', { campaign_id: id }] })
        }}
      />
    </div>
  )
}
