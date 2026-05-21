'use client'

import { useState, useEffect, useCallback, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/shared/PageHeader'
import { DealTable } from '@/components/deals/DealTable'
import { DeleteDealDialog } from '@/components/deals/DeleteDealDialog'
import { batchDeleteDeals, deleteAllDeals } from '@/lib/batch-delete'
import { pageHeadings } from '@/lib/page-headings'

interface Deal {
  id: string
  deal_name: string | null
  unit_count: number | null
  stage: string
  score: string | null
  created_at: string
  campaigns: { name: string; market: string } | null
  portfolios?: { id: string; name: string } | null
}

interface FieldDef {
  id: string
  key: string
  label: string
  data_type: string
  show_in_grid: boolean
  sort_order: number
}

const SEARCH_DEBOUNCE_MS = 300

export default function DealsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params)
  const router = useRouter()
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
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

  const debouncedSearchRef = useRef(search)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      debouncedSearchRef.current = search
      refetch()
    }, SEARCH_DEBOUNCE_MS)
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current) }
  }, [search])

  const buildUrl = useCallback((p: number, size: number) => {
    const offset = (p - 1) * size
    const params = new URLSearchParams({ limit: String(size), offset: String(offset) })
    params.set('sort', sortKey)
    params.set('order', sortDir)
    params.set('project_id', projectId)
    if (debouncedSearchRef.current) params.set('search', debouncedSearchRef.current)
    return `/api/deals?${params.toString()}`
  }, [sortKey, sortDir, projectId])

  const fetchPage = useCallback(async (p: number, size: number) => {
    const res = await fetch(buildUrl(p, size))
    if (!res.ok) throw new Error('Failed to fetch')
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
    setLoading(true)
    fetchPage(page, pageSize).finally(() => setLoading(false))
  }, [page, pageSize, fetchPage])

  useEffect(() => {
    fetch(`/api/field-definitions?project_id=${projectId}`)
      .then((r) => r.json())
      .then((data) => setFieldDefs(Array.isArray(data) ? data : []))
      .catch(() => setFieldDefs([]))
  }, [projectId])

  useEffect(() => {
    setLoading(true)
    fetchPage(page, pageSize).catch(() => setDeals([])).finally(() => setLoading(false))
  }, [page, pageSize, fetchPage])

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      <PageHeader
        title={pageHeadings.deals.title}
        description={loading && total === 0 ? 'Loading...' : `${total.toLocaleString()} deals in pipeline`}
      />

      <div className="flex-1 min-h-0">
        <DealTable
          key={gridKey}
          deals={deals}
          loading={loading}
          fieldDefs={fieldDefs}
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
          columnOrderStorageKey={`deals-table-${projectId}`}
          onRowClick={(r: Deal) => router.push(`/projects/${projectId}/deals/${r.id}`)}
          topToolbar={{
            recordLabel: 'deal',
            onAdd: () => router.push(`/projects/${projectId}/import`),
            onDelete: async (ids) => {
              if (allSelected) { setPendingDeleteIds([]); setDeleteOpen(true) }
              else { setPendingDeleteIds(Array.from(ids)); setDeleteOpen(true) }
            },
            searchValue: search,
            onSearchChange: setSearch,
          }}
        />
      </div>

      <DeleteDealDialog
        dealNames={pendingDeleteIds.map((id) => deals.find((d) => d.id === id)?.deal_name ?? 'Untitled Deal')}
        open={deleteOpen}
        allSelected={allSelected}
        totalCount={filteredTotal}
        onOpenChange={(open) => {
          setDeleteOpen(open)
          if (!open) { setPendingDeleteIds([]); setAllSelected(false) }
        }}
        onConfirm={async () => {
          if (allSelected) {
            await deleteAllDeals({ search: debouncedSearchRef.current || undefined, projectId })
          } else {
            await batchDeleteDeals(pendingDeleteIds)
          }
          setGridKey((k) => k + 1)
          refetch()
        }}
      />
    </div>
  )
}
