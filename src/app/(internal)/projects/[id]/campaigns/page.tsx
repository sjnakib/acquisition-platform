'use client'

import { useState, useMemo, use } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataGrid, type ColumnDef } from '@/components/shared/DataGrid'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CreateCampaignDialog } from '@/components/campaigns/CreateCampaignDialog'
import { DeleteCampaignDialog } from '@/components/campaigns/DeleteCampaignDialog'
import { useProjectContext } from '@/components/shared/ProjectContext'
import { pageHeadings } from '@/lib/page-headings'

interface Campaign {
  id: string
  name: string
  market: string
  listing_type: string | null
  is_active: boolean
}

export default function CampaignsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params)
  const { projectName } = useProjectContext()
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string> | undefined>(undefined)

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ['campaigns', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns?project_id=${projectId}`)
      if (!res.ok) throw new Error('Failed to fetch campaigns')
      return res.json()
    },
  })

  const selectedCampaigns = useMemo(() => {
    if (!selectedIds || selectedIds.size === 0) return []
    return campaigns.filter((c) => selectedIds.has(c.id))
  }, [campaigns, selectedIds])

  const clearSelection = () => setSelectedIds(undefined)

  const columns: ColumnDef<Campaign>[] = [
    {
      key: 'name', header: 'Name', minWidth: 160, sortable: true,
      render: (r) => <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{r.name}</span>,
    },
    { key: 'market', header: 'Market', width: 120, sortable: true },
    {
      key: 'listing_type', header: 'Type', width: 120, sortable: true,
      accessor: (r) => r.listing_type?.replace(/_/g, ' ') ?? '',
      render: (r) => <span style={{ color: 'var(--color-text-secondary)' }}>{r.listing_type?.replace(/_/g, ' ') ?? '—'}</span>,
    },
    {
      key: 'is_active', header: 'Status', width: 100, sortable: true,
      accessor: (r) => (r.is_active ? 'Active' : 'Inactive'),
      render: (r) => (
        <Badge variant={r.is_active ? 'success' : 'neutral'} size="sm">
          {r.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ]

  const selectedCount = selectedIds?.size ?? 0

  return (
    <div>
      <PageHeader
        title={pageHeadings.campaigns.title}
        description={pageHeadings.campaigns.description}
        breadcrumb={[
          { label: 'Projects', href: '/projects' },
          { label: projectName, href: `/projects/${projectId}/campaigns` },
          { label: 'Campaigns' },
        ]}
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            Create Campaign
          </Button>
        }
      />

      {selectedCount > 0 && (
        <div
          className="flex items-center justify-between px-4 py-2 rounded-lg mb-3 text-[13px]"
          style={{
            background: 'var(--color-danger-bg)',
            border: '1px solid var(--color-danger-border)',
            color: 'var(--color-danger-text)',
          }}
        >
          <span>{selectedCount} campaign{selectedCount !== 1 ? 's' : ''} selected</span>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Delete Selected
          </Button>
        </div>
      )}

      <DataGrid
        columns={columns}
        data={campaigns}
        rowKey={(r) => r.id}
        onRowClick={(r) => router.push(`/projects/${projectId}/campaigns/${r.id}`)}
        loading={isLoading}
        emptyMessage="No campaigns — create one first"
        emptyAction={{ label: 'Create Campaign', onClick: () => setCreateOpen(true) }}
        maxHeight="calc(100vh - 230px)"
        selectedRowIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />

      <CreateCampaignDialog open={createOpen} onOpenChange={setCreateOpen} projectId={projectId} />
      <DeleteCampaignDialog
        campaigns={selectedCampaigns}
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open)
          if (!open) clearSelection()
        }}
      />
    </div>
  )
}
