'use client'

import { useState, useEffect, useCallback } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { DealTable } from '@/components/deals/DealTable'
import { PaginationControls } from '@/components/shared/PaginationControls'
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

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [fieldDefs, setFieldDefs] = useState<FieldDef[]>([])

  const fetchPage = useCallback(async (p: number, size: number) => {
    const offset = (p - 1) * size
    const url = `/api/deals?limit=${size}&offset=${offset}`
    const res = await fetch(url)
    if (!res.ok) throw new Error('Failed to fetch')
    const json = await res.json()
    setDeals(Array.isArray(json.data) ? json.data : [])
    setTotal(json.total ?? 0)
  }, [])

  useEffect(() => {
    fetch('/api/field-definitions')
      .then((r) => r.json())
      .then((data) => setFieldDefs(Array.isArray(data) ? data : []))
      .catch(() => setFieldDefs([]))
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchPage(page, pageSize)
      .catch(() => setDeals([]))
      .finally(() => setLoading(false))
  }, [page, pageSize, fetchPage])

  const handlePageSize = (v: number) => {
    setPageSize(v)
    setPage(1)
  }

  return (
    <div>
      <PageHeader
        title={pageHeadings.deals.title}
        description={loading ? 'Loading...' : `${total.toLocaleString()} deals in pipeline`}
      />

      {!loading && (
        <div className="mb-3">
          <PaginationControls
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={handlePageSize}
          />
        </div>
      )}

      <DealTable deals={deals} loading={loading} fieldDefs={fieldDefs} />

      {total > pageSize && !loading && (
        <div className="mt-4">
          <PaginationControls
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={handlePageSize}
            showPageSize={false}
          />
        </div>
      )}
    </div>
  )
}
