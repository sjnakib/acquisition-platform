'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/shared/PageHeader'
import type { BreadcrumbItem } from '@/components/shared/Breadcrumb'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DealTable, type Deal } from '@/components/deals/DealTable'
export type { Deal } from '@/components/deals/DealTable'
import { DeleteDealDialog } from '@/components/deals/DeleteDealDialog'
import { batchDeleteDeals, deleteAllDeals } from '@/lib/batch-delete'
import { usePortfolios } from '@/lib/hooks/usePortfolios'
import { pageHeadings } from '@/lib/page-headings'

// ── Constants ────────────────────────────────────────────────────────────────

const SEARCH_DEBOUNCE_MS = 300

const LEADS_STAGES = ['lead', 'outreach', 'response']
const DEALS_STAGES = ['underwriting', 'loi', 'closed', 'failed']
const ARCHIVED_STAGES = ['archived']

interface FieldDef {
  id: string
  key: string
  label: string
  data_type: string
  show_in_grid: boolean
  sort_order: number
}

// ── Props ────────────────────────────────────────────────────────────────────

export interface DealsPageViewProps {
  projectId?: string
  editable?: boolean
  showToggle?: boolean
  showToolbar?: boolean
  onRowClick?: (deal: Deal) => void
  columnOrderStorageKey: string
  breadcrumb?: BreadcrumbItem[]
  title?: string
  description?: string
}

// ── Component ────────────────────────────────────────────────────────────────

export function DealsPageView({
  projectId,
  editable = true,
  showToggle = true,
  showToolbar = true,
  onRowClick,
  columnOrderStorageKey,
  breadcrumb,
  title,
  description,
}: DealsPageViewProps) {
  const router = useRouter()
  const { data: portfolios } = usePortfolios(projectId ?? '')

  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [filteredTotal, setFilteredTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [fieldDefs, setFieldDefs] = useState<FieldDef[]>([])
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([])
  const [allSelected, setAllSelected] = useState(false)
  const [gridKey, setGridKey] = useState(0)
  const [view, setView] = useState<'leads' | 'deals' | 'archived'>('leads')

  const debouncedSearchRef = useRef(search)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(null)

  // ── Data fetching ──────────────────────────────────────────────────────────

  const buildUrl = useCallback((p: number, size: number) => {
    const offset = (p - 1) * size
    const params = new URLSearchParams({ limit: String(size), offset: String(offset) })
    params.set('sort', sortKey)
    params.set('order', sortDir)
    if (projectId) params.set('project_id', projectId)
    if (debouncedSearchRef.current) params.set('search', debouncedSearchRef.current)
    // Stage filter for all views (internal + client)
    const stages = view === 'leads' ? LEADS_STAGES : view === 'deals' ? DEALS_STAGES : ARCHIVED_STAGES
    for (const s of stages) params.append('stage', s)
    return `/api/deals?${params.toString()}`
  }, [sortKey, sortDir, projectId, view, editable])

  const fetchPage = useCallback(async (p: number, size: number) => {
    setError(null)
    const res = await fetch(buildUrl(p, size))
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? `Request failed (${res.status})`)
    }
    const json = await res.json()
    const data = Array.isArray(json.data) ? json.data : []
    const totalCount = json.total ?? 0
    const filteredCount = json.filtered_total ?? totalCount
    setDeals(data)
    setTotal(totalCount)
    setFilteredTotal(filteredCount)
    if (data.length === 0 && filteredCount > 0 && p > 1) {
      const maxPage = Math.ceil(filteredCount / size)
      setPage(maxPage)
    }
  }, [buildUrl])

  const refetch = useCallback(() => {
    setTimeout(() => setLoading(true), 0)
    fetchPage(page, pageSize).finally(() => setLoading(false))
  }, [page, pageSize, fetchPage])

  // Search debounce
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      debouncedSearchRef.current = search
      refetch()
    }, SEARCH_DEBOUNCE_MS)
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current) }
  }, [search])

  // Field definitions
  useEffect(() => {
    const url = projectId
      ? `/api/field-definitions?project_id=${projectId}`
      : '/api/field-definitions'
    fetch(url)
      .then((r) => r.json())
      .then((data) => setFieldDefs(Array.isArray(data) ? data : []))
      .catch(() => setFieldDefs([]))
  }, [projectId])

  // Initial + page/size changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true)
      fetchPage(page, pageSize).catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load deals')
        setDeals([])
      }).finally(() => setLoading(false))
    }, 0)
    return () => clearTimeout(timer)
  }, [page, pageSize, fetchPage])

  // ── Derived values ─────────────────────────────────────────────────────────

  const viewLabel = view === 'leads' ? 'leads' : view === 'deals' ? 'deals' : 'archived deals'
  const descriptionText = description ?? (loading && total === 0 ? 'Loading...' : `${total.toLocaleString()} ${viewLabel} in pipeline`)

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleDelete = async (ids: string[]) => {
    if (allSelected) { setPendingDeleteIds([]); setDeleteOpen(true) }
    else { setPendingDeleteIds(Array.from(ids)); setDeleteOpen(true) }
  }

  const handleDeleteConfirm = async () => {
    if (allSelected) {
      const opts: { search?: string; projectId?: string } = { search: debouncedSearchRef.current || undefined }
      if (projectId) opts.projectId = projectId
      await deleteAllDeals(opts)
    } else {
      await batchDeleteDeals(pendingDeleteIds)
    }
    setGridKey((k) => k + 1)
    refetch()
  }

  const importPath = projectId ? `/projects/${projectId}/import` : '/import'
  const dealDetailPath = projectId
    ? (dealId: string) => `/projects/${projectId}/deals/${dealId}`
    : undefined
  const handleRowClick = onRowClick ?? (dealDetailPath
    ? (deal: Deal) => { router.push(dealDetailPath(deal.id)) }
    : undefined)

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      <PageHeader
        title={title ?? pageHeadings.deals.title}
        description={descriptionText}
        breadcrumb={breadcrumb}
        actions={showToggle ? (
          <Tabs
            defaultValue="leads"
            value={view}
            onValueChange={(v) => { setView(v as 'leads' | 'deals' | 'archived'); setPage(1) }}
          >
            <TabsList>
              <TabsTrigger value="leads">Leads</TabsTrigger>
              <TabsTrigger value="deals">Deals</TabsTrigger>
              <TabsTrigger value="archived">Archived</TabsTrigger>
            </TabsList>
          </Tabs>
        ) : undefined}
      />

      <div className="flex-1 min-h-0">
        {error && (
          <div className="mx-4 mt-2 p-3 rounded-md text-[12px] font-medium border"
            style={{ background: 'var(--color-danger-bg)', borderColor: 'var(--color-danger-border)', color: 'var(--color-danger-text)' }}>
            {error}
          </div>
        )}
        <DealTable
          key={`${gridKey}-${view}`}
          deals={deals}
          loading={loading}
          fieldDefs={fieldDefs}
          portfolios={portfolios ?? []}
          view={view}
          editable={editable}
          fillHeight
          totalRows={filteredTotal}
          page={page}
          pageSize={pageSize}
          onPageChange={(p) => { setPage(p); setAllSelected(false) }}
          onPageSizeChange={(v) => { setPageSize(v); setPage(1); setAllSelected(false) }}
          allRowsSelected={allSelected}
          onSelectAll={() => setAllSelected(true)}
          onSelectionChange={(ids) => { if (allSelected && ids.size === 0) setAllSelected(false) }}
          serverSide
          serverSortKey={sortKey}
          serverSortDir={sortDir}
          onSortChange={(key, dir) => { setSortKey(key); setSortDir(dir); setAllSelected(false) }}
          columnOrderStorageKey={columnOrderStorageKey}
          onRowClick={handleRowClick}
          topToolbar={showToolbar ? {
            recordLabel: view === 'leads' ? 'lead' : 'deal',
            onAdd: () => router.push(importPath),
            onDelete: handleDelete,
            searchValue: search,
            onSearchChange: setSearch,
          } : undefined}
        />
      </div>

      {showToolbar && (
        <DeleteDealDialog
          dealNames={pendingDeleteIds.map((id) => {
            const d = deals.find((d) => d.id === id)
            const df = d?.deal_fields?.find((f) => f?.field_definitions?.key === 'address')
            return df?.value ?? 'Untitled Deal'
          })}
          open={deleteOpen}
          allSelected={allSelected}
          totalCount={filteredTotal}
          onOpenChange={(open) => {
            setDeleteOpen(open)
            if (!open) { setPendingDeleteIds([]); setAllSelected(false) }
          }}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </div>
  )
}
