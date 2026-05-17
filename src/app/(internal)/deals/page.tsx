'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/shared/PageHeader'
import { DealTable } from '@/components/deals/DealTable'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { pageHeadings } from '@/lib/page-headings'

const PAGE_SIZES = [25, 50, 100, 250]

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

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

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
    setLoading(true)
    fetchPage(page, pageSize)
      .catch(() => setDeals([]))
      .finally(() => setLoading(false))
  }, [page, pageSize, fetchPage])

  const handlePageSize = (v: string) => {
    setPageSize(Number(v))
    setPage(1)
  }

  // Build visible page numbers
  const pages: (number | '...')[] = []
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...')
    }
  }

  const s = {
    text: { color: 'var(--color-text-secondary)' } as const,
    muted: { color: 'var(--color-text-tertiary)' } as const,
  }

  return (
    <div>
      <PageHeader
        title={pageHeadings.deals.title}
        description={loading ? 'Loading...' : `${total.toLocaleString()} deals in pipeline`}
      />

      {/* Pagination top bar */}
      {total > 0 && !loading && (
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-[13px]" style={s.muted}>
            <span>Rows per page</span>
            <Select value={String(pageSize)} onValueChange={handlePageSize}>
              <SelectTrigger className="h-[30px] w-[70px] text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((s) => (
                  <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>{start.toLocaleString()}–{end.toLocaleString()} of {total.toLocaleString()}</span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-[30px] w-[30px]"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {pages.map((p, i) =>
              p === '...' ? (
                <span key={`dots-${i}`} className="px-1 text-[13px]" style={s.muted}>…</span>
              ) : (
                <Button
                  key={p}
                  variant={p === page ? 'default' : 'outline'}
                  size="icon"
                  className="h-[30px] w-[30px] text-[13px]"
                  style={p === page ? { background: 'var(--accent)', color: '#FFF' } : undefined}
                  onClick={() => setPage(p)}
                >
                  {p}
                </Button>
              )
            )}
            <Button
              variant="outline"
              size="icon"
              className="h-[30px] w-[30px]"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <DealTable deals={deals} loading={loading} />

      {/* Pagination bottom bar */}
      {total > pageSize && !loading && (
        <div className="flex justify-center mt-4">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-[30px] w-[30px]"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {pages.map((p, i) =>
              p === '...' ? (
                <span key={`dots2-${i}`} className="px-1 text-[13px]" style={s.muted}>…</span>
              ) : (
                <Button
                  key={`b-${p}`}
                  variant={p === page ? 'default' : 'outline'}
                  size="icon"
                  className="h-[30px] w-[30px] text-[13px]"
                  style={p === page ? { background: 'var(--accent)', color: '#FFF' } : undefined}
                  onClick={() => setPage(p)}
                >
                  {p}
                </Button>
              )
            )}
            <Button
              variant="outline"
              size="icon"
              className="h-[30px] w-[30px]"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
