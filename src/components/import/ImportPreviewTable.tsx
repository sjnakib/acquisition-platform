'use client'

import { useMemo } from 'react'
import { DataGrid, type ColumnDef } from '@/components/shared/DataGrid'

type PreviewRow = Record<string, unknown>

interface ImportPreviewTableProps {
  data: PreviewRow[]
}

export function ImportPreviewTable({ data }: ImportPreviewTableProps) {
  const columns: ColumnDef<PreviewRow>[] = useMemo(() => {
    if (!data.length) return []
    // Dynamically build columns from actual data keys
    const keys = Object.keys(data[0] ?? {})
    return keys.map((key) => ({
      key,
      header: key,
      sortable: true,
      minWidth: 100,
      maxWidth: 300,
      align: 'left' as const,
    }))
  }, [data])

  return (
    <DataGrid
      columns={columns}
      data={data}
      rowKey={(_, i) => String(i)}
      emptyMessage="No data to preview"
      maxHeight={480}
    />
  )
}
