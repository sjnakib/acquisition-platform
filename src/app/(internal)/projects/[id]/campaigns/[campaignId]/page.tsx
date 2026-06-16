'use client'

import { useState, useMemo, useRef, useEffect, use, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BarChart3, Mail, Inbox } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Breadcrumb } from '@/components/shared/Breadcrumb'
import { useProjectContext } from '@/components/shared/ProjectContext'
import { DealTable, type Deal } from '@/components/deals/DealTable'
import { DeleteDealDialog } from '@/components/deals/DeleteDealDialog'
import { batchDeleteDeals, deleteAllDeals } from '@/lib/batch-delete'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { EmailTemplateManager } from '@/components/campaigns/EmailTemplateManager'
import { CampaignEmailView } from '@/components/campaigns/CampaignEmailView'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { toast } from 'sonner'
import { useGoogleConnection } from '@/lib/hooks/useGoogleConnection'
import { GoogleReconnectDialog } from '@/components/shared/GoogleReconnectDialog'

interface Campaign {
  id: string; name: string; market: string; listing_type: string | null
  email_template: string | null; email_template_id: string | null
  email_subject_template: string | null; email_body_template: string | null
  target_response_rate_pct: number | null; target_loi_count: number | null
  is_active: boolean; created_at: string
}

interface FieldDef {
  id: string; key: string; label: string; data_type: string; show_in_grid: boolean; sort_order: number; source?: string | null
}

function CampaignDetailContent({ projectId, campaignId }: { projectId: string; campaignId: string }) {
  const { projectName } = useProjectContext()
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const tab = (searchParams.get('tab') as 'details' | 'leads' | 'emails') ?? 'leads'
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const pageSize = parseInt(searchParams.get('pageSize') ?? '50', 10)
  const sortKey = searchParams.get('sort') ?? 'created_at'
  const sortDir = (searchParams.get('order') ?? 'desc') as 'asc' | 'desc'
  const [search, setSearch] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([])
  const [allSelected, setAllSelected] = useState(false); const [gridKey, setGridKey] = useState(0)

  const updateParams = useCallback((updates: Record<string, string | null>) => {
    const p = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) p.delete(key)
      else p.set(key, value)
    }
    router.replace(`${pathname}?${p.toString()}`, { scroll: false })
  }, [searchParams, router, pathname])

  const [debouncedSearch, setDebouncedSearch] = useState('')
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(null)
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(search), 300)
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current) }
  }, [search])

  const { data: campaign, isLoading: campaignLoading } = useQuery<Campaign>({
    queryKey: ['campaigns', campaignId],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}`)
      if (!res.ok) throw new Error('Failed to fetch campaign')
      return res.json()
    },
  })

  const { data: dealsData, isLoading: dealsLoading } = useQuery<{ data: Deal[]; total: number }>({
    queryKey: ['deals', { campaign_id: campaignId, project_id: projectId, page, pageSize, search: debouncedSearch, sort: sortKey, order: sortDir }],
    queryFn: async () => {
      const offset = (page - 1) * pageSize
      const p = new URLSearchParams({
        campaign_id: campaignId, project_id: projectId, limit: String(pageSize), offset: String(offset),
        sort: sortKey, order: sortDir,
      })
      if (debouncedSearch) p.set('search', debouncedSearch)
      const res = await fetch(`/api/deals?${p.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch deals')
      return res.json()
    },
  })

  const { data: allDeals } = useQuery<Pick<Deal, 'stage' | 'deal_fields'>[]>({
    queryKey: ['deals', { campaign_id: campaignId, project_id: projectId, select: 'stage' }],
    queryFn: async () => {
      const p = new URLSearchParams({ campaign_id: campaignId, project_id: projectId, limit: '1000' })
      const res = await fetch(`/api/deals?${p.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch deal metrics')
      const json = await res.json()
      return (json.data ?? []) as Pick<Deal, 'stage' | 'deal_fields'>[]
    },
    enabled: tab === 'details',
  })

  const { data: fieldDefs = [] } = useQuery<FieldDef[]>({
    queryKey: ['field-definitions', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/field-definitions?project_id=${projectId}`)
      if (!res.ok) throw new Error('Failed to fetch field definitions')
      return res.json()
    },
  })

  // Google connection details for this project
  const { status: connStatus, googleEmail, reconnectUrl } = useGoogleConnection(projectId)
  const gmailConnected = connStatus === 'connected'
  const [reconnectDialogOpen, setReconnectDialogOpen] = useState(false)

  const handleCampaignUpdate = async (updates: Partial<Campaign>) => {
    try {
      const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || body.details || 'Failed to update campaign')
      }
      queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId] })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save template'
      toast.error(message)
    }
  }

  const deals = dealsData?.data ?? []
  const total = dealsData?.total ?? 0
  const leadCount = (allDeals ?? []).filter((d) => d.stage === 'lead').length

  const stageCounts = useMemo(() => {
    const counts = { lead: 0, outreach: 0, response: 0, active: 0 }
    if (!allDeals) return counts
    for (const d of allDeals) {
      if (d.stage === 'lead') counts.lead++
      if (d.stage === 'outreach') counts.outreach++
      if (d.stage === 'response') counts.response++
      if (d.stage !== 'archived') counts.active++
    }
    return counts
  }, [allDeals])

  const activeTab = total === 0 ? 'leads' : tab

  useEffect(() => {
    if (deals.length === 0 && total > 0 && page > 1) {
      const maxPage = Math.ceil(total / pageSize)
      const timer = setTimeout(() => {
        updateParams({ page: String(Math.min(page, maxPage)) })
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [deals.length, total, page, pageSize, updateParams])

  if (campaignLoading) return <div className="flex justify-center py-20"><LoadingSpinner size="page" /></div>
  if (!campaign) return <div className="text-center py-20 text-[var(--color-text-tertiary)]">Campaign not found.</div>

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] -mb-4">
      <Breadcrumb
        items={[
          { label: 'Projects', href: '/projects' },
          { label: projectName, href: `/projects/${projectId}/campaigns` },
          { label: 'Campaigns', href: `/projects/${projectId}/campaigns` },
          { label: campaign.name },
        ]}
      />

      <div className="flex items-center gap-2 flex-shrink-0 mb-3 mt-1">
        <h1 className="text-[17px] font-medium tracking-[-0.02em] truncate text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          {campaign.name}
        </h1>
        <Badge variant={campaign.is_active ? 'success' : 'neutral'} size="sm">{campaign.is_active ? 'Active' : 'Inactive'}</Badge>
        <span className="text-xs text-[var(--color-text-secondary)]">{campaign.market}</span>
        {campaign.listing_type && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-[var(--radius-md)] bg-[var(--color-surface-1)] text-xs text-[var(--color-text-secondary)]">
            {campaign.listing_type.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      <Tabs defaultValue="leads" value={activeTab} onValueChange={(v) => updateParams({ tab: v, page: '1' })} className="flex-1 flex flex-col min-h-0">
        <TabsList className="mb-4 flex-shrink-0">
          {total === 0 ? (
            <Tooltip content="Import leads first to enable mass emailing" position="bottom">
              <TabsTrigger value="details" disabled={total === 0}>Mass Emailing</TabsTrigger>
            </Tooltip>
          ) : (
            <TabsTrigger value="details" disabled={total === 0}>Mass Emailing</TabsTrigger>
          )}
          <TabsTrigger value="leads">Leads{total > 0 ? ` (${total})` : ''}</TabsTrigger>
          <TabsTrigger value="emails">
            <span className="flex items-center gap-1.5">
              <Inbox size={13} />
              Emails
            </span>
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 min-h-0 flex flex-col">
          <TabsContent value="details" className="h-full">
            <div className="flex gap-6 h-full min-h-0 pb-4">
              {/* Left 75% — Email Template Workspace */}
              <div className="flex-1 min-w-0 h-full flex flex-col">
                <EmailTemplateManager
                  campaign={campaign}
                  projectId={projectId}
                  leadsCount={leadCount}
                  gmailConnected={gmailConnected}
                  onAuthExpired={() => setReconnectDialogOpen(true)}
                  onCampaignUpdate={handleCampaignUpdate}
                  connectionStatus={connStatus}
                />
              </div>

              {/* Right 25% — Compact stats & Google Status */}
              <div className="w-80 flex-shrink-0 flex flex-col gap-4 h-full overflow-y-auto pr-1">
                {/* Outreach Funnel stats card */}
                <div className="bg-[var(--color-surface-0)] border border-[var(--color-surface-2)] rounded-[var(--radius-lg)] p-5 shadow-[var(--shadow-xs)] flex flex-col gap-4">
                  <div className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-[0.06em] flex items-center gap-1.5 pb-2 border-b border-[var(--color-surface-2)]">
                    <BarChart3 className="h-4 w-4" /> Outreach Funnel
                  </div>

                  <div className="space-y-4">
                    {/* Leads Ready */}
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-[var(--color-text-secondary)] font-medium">Leads (not emailed)</span>
                      <span className="text-xs font-semibold font-mono text-[var(--color-text-primary)] bg-[var(--color-surface-1)] px-2 py-0.5 rounded-[var(--radius-sm)] border border-[var(--color-surface-2)]">
                        {stageCounts.lead}
                      </span>
                    </div>

                    {/* Emailed */}
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-[var(--color-text-secondary)] font-medium">Outreach Sent</span>
                      <span className="text-xs font-semibold font-mono text-[var(--color-text-primary)] bg-[var(--color-surface-1)] px-2 py-0.5 rounded-[var(--radius-sm)] border border-[var(--color-surface-2)]">
                        {stageCounts.outreach}
                      </span>
                    </div>

                    {/* Responses */}
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-[var(--color-text-secondary)] font-medium">Responses Received</span>
                      <span className="text-xs font-semibold font-mono text-[var(--color-success-text)] bg-[var(--color-success-bg)] border border-[var(--color-success-border)] px-2 py-0.5 rounded-[var(--radius-sm)]">
                        {stageCounts.response}
                      </span>
                    </div>

                    <div className="border-t border-[var(--color-surface-2)] pt-3 flex flex-col gap-2">
                      {/* Response Rate */}
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[var(--color-text-secondary)] font-medium">Response Rate</span>
                        <span className="font-semibold font-mono text-[var(--color-text-primary)]">
                          {(() => {
                            const contacted = stageCounts.outreach + stageCounts.response
                            if (contacted === 0) return '0%'
                            return `${Math.round((stageCounts.response / contacted) * 100)}%`
                          })()}
                        </span>
                      </div>

                      {campaign.target_response_rate_pct != null && (
                        <div className="flex justify-between items-center text-[10px] text-[var(--color-text-tertiary)]">
                          <span>Target Rate</span>
                          <span className="font-mono">{campaign.target_response_rate_pct}%</span>
                        </div>
                      )}

                      {campaign.target_loi_count != null && (
                        <div className="flex justify-between items-center text-[10px] text-[var(--color-text-tertiary)]">
                          <span>Target LOIs</span>
                          <span className="font-mono">{campaign.target_loi_count}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Gmail Connection Status Card */}
                <div className="bg-[var(--color-surface-0)] border border-[var(--color-surface-2)] rounded-[var(--radius-lg)] p-5 shadow-[var(--shadow-xs)] flex flex-col gap-4">
                  <div className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-[0.06em] flex items-center gap-1.5 pb-2 border-b border-[var(--color-surface-2)]">
                    <Mail className="h-4 w-4" /> Sending Identity
                  </div>

                  {connStatus === 'connected' ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-success-text)]">
                        <span className="h-2 w-2 rounded-full bg-[var(--color-success-solid)] animate-pulse" />
                        Gmail Connected
                      </div>
                      <div className="text-xs font-mono text-[var(--color-text-secondary)] bg-[var(--color-surface-1)] p-2.5 rounded-[var(--radius-md)] border border-[var(--color-surface-2)] break-all leading-normal">
                        {googleEmail}
                      </div>
                    </div>
                  ) : connStatus === 'expired' ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-warning-text)]">
                        <span className="h-2 w-2 rounded-full bg-[var(--color-warning-solid)]" />
                        Gmail Connection Expired
                      </div>
                      <div className="text-xs font-mono text-[var(--color-text-secondary)] bg-[var(--color-surface-1)] p-2.5 rounded-[var(--radius-md)] border border-[var(--color-surface-2)] break-all leading-normal">
                        {googleEmail}
                      </div>
                      <p className="text-[11px] text-[var(--color-text-tertiary)] leading-normal">
                        Your Gmail connection has expired. Please reconnect to continue sending emails.
                      </p>
                      <Button
                        size="sm"
                        onClick={() => setReconnectDialogOpen(true)}
                        className="w-full h-8 text-xs font-semibold bg-[var(--accent)] text-[var(--color-text-inverse)] hover:opacity-95"
                      >
                        Reconnect Gmail
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-warning-text)]">
                        <span className="h-2 w-2 rounded-full bg-[var(--color-warning-solid)]" />
                        Gmail Disconnected
                      </div>
                      <p className="text-[11px] text-[var(--color-text-tertiary)] leading-normal">
                        Outreach emails cannot be sent until you authenticate a Gmail connection.
                      </p>
                      <Button
                        size="sm"
                        onClick={() => router.push(`/projects/${projectId}/settings`)}
                        className="w-full h-8 text-xs font-semibold bg-[var(--accent)] text-[var(--color-text-inverse)] hover:opacity-95"
                      >
                        Connect Gmail Account
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="leads" className="h-full">
            <div className="flex flex-col h-full pb-4">
              <div className="flex-1 min-h-0">
                <DealTable
                  key={gridKey} deals={deals} loading={dealsLoading} fieldDefs={fieldDefs}
                  emptyAction={{ label: 'Import Leads', onClick: () => router.push(`/projects/${projectId}/import?campaignId=${campaignId}`) }}
                  fillHeight totalRows={total} page={page} pageSize={pageSize}
                  onPageChange={(p) => { updateParams({ page: String(p) }); setAllSelected(false) }}
                  onPageSizeChange={(v) => { updateParams({ pageSize: String(v), page: '1' }); setAllSelected(false) }}
                  allRowsSelected={allSelected}
                  onSelectionChange={(ids) => { if (allSelected && ids.size === 0) setAllSelected(false) }}
                  serverSide serverSortKey={sortKey} serverSortDir={sortDir}
                  onSortChange={(key, dir) => { updateParams({ sort: key, order: dir }); setAllSelected(false) }}
                  onSelectAll={() => setAllSelected(true)}
                  onRowClick={(r: Deal) => router.push(`/projects/${projectId}/deals/${r.id}`)}
                  topToolbar={{
                    recordLabel: 'deal',
                    onAdd: () => router.push(`/projects/${projectId}/import?campaignId=${campaignId}`),
                    onDelete: async (ids) => {
                      if (allSelected) { setPendingDeleteIds([]); setDeleteOpen(true) }
                      else { setPendingDeleteIds(Array.from(ids)); setDeleteOpen(true) }
                    },
                    searchValue: search, onSearchChange: setSearch,
                  }}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="emails" className="h-full">
            <div className="h-full pb-4">
              <CampaignEmailView campaignId={campaignId} projectId={projectId} />
            </div>
          </TabsContent>
        </div>
      </Tabs>

      <DeleteDealDialog
        dealNames={pendingDeleteIds.map((id) => {
          const d = deals.find((d) => d.id === id)
          const df = d?.deal_fields?.find((f) => f?.field_definitions?.key === 'address')
          return df?.value ?? 'Untitled Deal'
        })}
        open={deleteOpen} allSelected={allSelected} totalCount={total}
        onOpenChange={(open) => { setDeleteOpen(open); if (!open) { setPendingDeleteIds([]); setAllSelected(false) } }}
        onConfirm={async () => {
          if (allSelected) {
            await deleteAllDeals({ campaign_id: campaignId, search: debouncedSearch || undefined, projectId })
          } else {
            await batchDeleteDeals(pendingDeleteIds)
          }
          setGridKey((k) => k + 1)
          queryClient.invalidateQueries({ queryKey: ['deals', { campaign_id: campaignId }] })
        }}
      />
      <GoogleReconnectDialog
        open={reconnectDialogOpen}
        onOpenChange={setReconnectDialogOpen}
        reconnectUrl={reconnectUrl ?? `/api/auth/google?projectId=${projectId}`}
      />
    </div>
  )
}

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string; campaignId: string }> }) {
  const { id, campaignId } = use(params)
  return (
    <Suspense fallback={<LoadingSpinner size="lg" />}>
      <CampaignDetailContent projectId={id} campaignId={campaignId} />
    </Suspense>
  )
}
