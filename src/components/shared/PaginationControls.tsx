'use client'

import { useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const DEFAULT_PAGE_SIZES = [25, 50, 100, 250]

interface PaginationControlsProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  pageSizes?: number[]
  /** Show rows-per-page selector + "X–Y of Z" label. Default true. */
  showPageSize?: boolean
}

const s = {
  muted: { color: 'var(--color-text-tertiary)' } as const,
  accent: 'var(--accent)' as const,
}

export function PaginationControls({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizes = DEFAULT_PAGE_SIZES,
  showPageSize = true,
}: PaginationControlsProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  const pages = useMemo(() => {
    const p: (number | '...')[] = []
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
        p.push(i)
      } else if (p[p.length - 1] !== '...') {
        p.push('...')
      }
    }
    return p
  }, [page, totalPages])

  if (total === 0) return null

  return (
    <div className={`flex items-center ${showPageSize ? 'justify-between' : 'justify-center'}`}>
      {showPageSize && (
        <div className="flex items-center gap-2 text-[13px]" style={s.muted}>
          <span>Rows per page</span>
          <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
            <SelectTrigger className="h-[30px] w-[70px] text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizes.map((ps) => (
                <SelectItem key={ps} value={String(ps)}>{ps}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span>{start.toLocaleString()}–{end.toLocaleString()} of {total.toLocaleString()}</span>
        </div>
      )}

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-[30px] w-[30px]"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
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
              style={p === page ? { background: s.accent, color: 'var(--color-text-inverse)' } : undefined}
              onClick={() => onPageChange(p)}
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
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
