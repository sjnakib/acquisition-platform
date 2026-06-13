'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
  portfolioView?: boolean
  onRowClick?: (deal: Deal) => void
  onAdd?: () => void
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
  portfolioView = false,
  onRowClick,
  onAdd,
  columnOrderStorageKey,
  breadcrumb,
  title,
  description,
}: DealsPageViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const { data: portfolios } = usePortfolios(projectId ?? '')

  const queryClient = useQueryClient()
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const pageSize = parseInt(searchParams.get('pageSize') ?? '50', 10)
  const sortKey = searchParams.get('sort') ?? 'created_at'
  const sortDir = (searchParams.get('order') ?? 'desc') as 'asc' | 'desc'
  const view = (searchParams.get('view') ?? 'leads') as 'leads' | 'deals' | 'archived'
  const [fieldDefs, setFieldDefs] = useState<FieldDef[]>([])
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([])
  const [allSelected, setAllSelected] = useState(false)
  const [gridKey, setGridKey] = useState(0)

  const updateParams = useCallback((updates: Record<string, string | null>) => {
    const p = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) p.delete(key)
      else p.set(key, value)
    }
    router.replace(`${pathname}?${p.toString()}`, { scroll: false })
  }, [searchParams, router, pathname])

  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(null)

  // ── Data fetching ──────────────────────────────────────────────────────────

  const buildUrl = useCallback((p: number, size: number, searchTerm: string) => {
    const offset = (p - 1) * size
    const params = new URLSearchParams({ limit: String(size), offset: String(offset) })
    params.set('sort', sortKey)
    params.set('order', sortDir)
    if (projectId) params.set('project_id', projectId)
    params.set('is_portfolio', portfolioView ? 'true' : 'false')
    if (searchTerm) params.set('search', searchTerm)
    // Stage filter for all views (internal + client)
    const stages = view === 'leads' ? LEADS_STAGES : view === 'deals' ? DEALS_STAGES : ARCHIVED_STAGES
    for (const s of stages) params.append('stage', s)
    return `/api/deals?${params.toString()}`
  }, [sortKey, sortDir, projectId, view, portfolioView])

  const {
    data: dealsData,
    isLoading: loading,
    isFetching,
    error: queryError,
  } = useQuery({
    queryKey: ['deals', { projectId, view, page, pageSize, sort: sortKey, order: sortDir, search: debouncedSearch, portfolioView }],
    queryFn: async () => {
      const res = await fetch(buildUrl(page, pageSize, debouncedSearch))
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Request failed (${res.status})`)
      }
      const json = await res.json()
      if (json.data && json.data.length === 0 && json.filtered_total > 0 && page > 1) {
        const maxPage = Math.ceil(json.filtered_total / pageSize)
        updateParams({ page: String(maxPage) })
      }
      return {
        deals: (Array.isArray(json.data) ? json.data : []) as Deal[],
        total: (json.total ?? 0) as number,
        filteredTotal: (json.filtered_total ?? json.total ?? 0) as number,
      }
    },
    staleTime: 0,
    placeholderData: (prev) => prev,
  })

  const deals = dealsData?.deals ?? []
  const total = dealsData?.total ?? 0
  const filteredTotal = dealsData?.filteredTotal ?? 0
  const error = queryError ? (queryError instanceof Error ? queryError.message : 'Failed to load deals') : null

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['deals'] })
  }, [queryClient])

  // Search debounce
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search)
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

  // ── Derived values ─────────────────────────────────────────────────────────

  const viewLabel = portfolioView
    ? (total === 1 ? 'portfolio' : 'portfolios')
    : (view === 'leads' ? 'leads' : view === 'deals' ? 'deals' : 'archived deals')
  const descriptionText = description ?? (loading && total === 0 ? 'Loading...' : `${total.toLocaleString()} ${viewLabel}${portfolioView ? '' : ' in pipeline'}`)
  const effectiveShowToggle = showToggle

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleDelete = async (ids: string[]) => {
    if (allSelected) { setPendingDeleteIds([]); setDeleteOpen(true) }
    else { setPendingDeleteIds(Array.from(ids)); setDeleteOpen(true) }
  }

  const handleDeleteConfirm = async () => {
    if (allSelected) {
      const opts: { search?: string; projectId?: string } = { search: debouncedSearch || undefined }
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
        actions={effectiveShowToggle ? (
          <Tabs
            defaultValue="leads"
            value={view}
            onValueChange={(v) => { updateParams({ view: v, page: '1' }) }}
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
          loading={loading || (isFetching && deals.length === 0)}
          fieldDefs={fieldDefs}
          portfolios={portfolios ?? []}
          view={view}
          editable={editable}
          fillHeight
          excludeColumns={portfolioView ? ['portfolio'] : undefined}
          totalRows={filteredTotal}
          page={page}
          pageSize={pageSize}
          onPageChange={(p) => { updateParams({ page: String(p) }); setAllSelected(false) }}
          onPageSizeChange={(v) => { updateParams({ pageSize: String(v), page: '1' }); setAllSelected(false) }}
          allRowsSelected={allSelected}
          onSelectAll={() => setAllSelected(true)}
          onSelectionChange={(ids) => { if (allSelected && ids.size === 0) setAllSelected(false) }}
          serverSide
          serverSortKey={sortKey}
          serverSortDir={sortDir}
          onSortChange={(key, dir) => { updateParams({ sort: key, order: dir }); setAllSelected(false) }}
          columnOrderStorageKey={columnOrderStorageKey}
          onRowClick={handleRowClick}
          topToolbar={showToolbar ? {
            recordLabel: portfolioView ? 'portfolio' : view === 'leads' ? 'lead' : 'deal',
            onAdd: onAdd ?? (portfolioView ? undefined : (() => router.push(importPath))),
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
