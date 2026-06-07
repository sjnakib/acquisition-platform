'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/shared/PageHeader'
import { DealTable, type Deal } from '@/components/deals/DealTable'
import { DeleteDealDialog } from '@/components/deals/DeleteDealDialog'
import { batchDeleteDeals, deleteAllDeals } from '@/lib/batch-delete'
import { pageHeadings } from '@/lib/page-headings'

interface FieldDef {
  id: string
  key: string
  label: string
  data_type: string
  show_in_grid: boolean
  sort_order: number
}

const SEARCH_DEBOUNCE_MS = 300

const LEADS_STAGES = ['lead', 'outreach', 'response']
const DEALS_STAGES = ['underwriting', 'loi', 'closed', 'failed']

export default function DealsPage() {
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
  const [view, setView] = useState<'leads' | 'deals'>('leads')

  const debouncedSearchRef = useRef(search)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(null)

  const buildUrl = useCallback((p: number, size: number) => {
    const offset = (p - 1) * size
    const params = new URLSearchParams({ limit: String(size), offset: String(offset) })
    params.set('sort', sortKey)
    params.set('order', sortDir)
    if (debouncedSearchRef.current) params.set('search', debouncedSearchRef.current)
    const stages = view === 'leads' ? LEADS_STAGES : DEALS_STAGES
    for (const s of stages) params.append('stage', s)
    return `/api/deals?${params.toString()}`
  }, [sortKey, sortDir, view])

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

  const refetch = () => {
    setLoading(true)
    fetchPage(page, pageSize).finally(() => setLoading(false))
  }

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      debouncedSearchRef.current = search
      refetch()
    }, SEARCH_DEBOUNCE_MS)
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current) }
  }, [search])

  useEffect(() => {
    fetch('/api/field-definitions')
      .then((r) => r.json())
      .then((data) => setFieldDefs(Array.isArray(data) ? data : []))
      .catch(() => setFieldDefs([]))
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true)
      fetchPage(page, pageSize).catch(() => setDeals([])).finally(() => setLoading(false))
    }, 0)
    return () => clearTimeout(timer)
  }, [page, pageSize, fetchPage])

  const viewToggle = (
    <div className="flex rounded-md overflow-hidden border" style={{ borderColor: 'var(--color-surface-3)' }}>
      <button
        onClick={() => { setView('leads'); setPage(1) }}
        className="px-3 py-1 text-[12px] font-medium transition-colors"
        style={{
          background: view === 'leads' ? 'var(--color-accent)' : 'var(--color-surface-0)',
          color: view === 'leads' ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
        }}
      >
        Leads
      </button>
      <button
        onClick={() => { setView('deals'); setPage(1) }}
        className="px-3 py-1 text-[12px] font-medium transition-colors"
        style={{
          background: view === 'deals' ? 'var(--color-accent)' : 'var(--color-surface-0)',
          color: view === 'deals' ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
        }}
      >
        Deals
      </button>
    </div>
  )

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      <PageHeader
        title={pageHeadings.deals.title}
        description={loading && total === 0 ? 'Loading...' : `${total.toLocaleString()} ${view === 'leads' ? 'leads' : 'deals'} in pipeline`}
        actions={viewToggle}
      />

      <div className="flex-1 min-h-0">
        <DealTable
          key={`${gridKey}-${view}`}
          deals={deals}
          loading={loading}
          fieldDefs={fieldDefs}
          view={view}
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
          columnOrderStorageKey={`deals-table-${view}`}
          topToolbar={{
            recordLabel: view === 'leads' ? 'lead' : 'deal',
            onAdd: () => router.push('/import'),
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
        onConfirm={async () => {
          if (allSelected) {
            await deleteAllDeals({ search: debouncedSearchRef.current || undefined })
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
