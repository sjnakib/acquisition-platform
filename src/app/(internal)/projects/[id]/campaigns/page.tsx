'use client'

import { useState, use, Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { CampaignCard } from '@/components/campaigns/CampaignCard'
import { CreateCampaignDialog } from '@/components/campaigns/CreateCampaignDialog'
import { useProjectContext } from '@/components/shared/ProjectContext'
import { pageHeadings } from '@/lib/page-headings'

interface Campaign {
  id: string
  name: string
  market: string
  listing_type: string | null
  is_active: boolean
  created_at: string
  deal_count: number
  awaiting_review_count: number
}

function CampaignsContent({ projectId }: { projectId: string }) {
  const { projectName } = useProjectContext()
  const [createOpen, setCreateOpen] = useState(false)

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ['campaigns', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns?project_id=${projectId}`)
      if (!res.ok) throw new Error('Failed to fetch campaigns')
      return res.json()
    },
  })

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
            <Plus className="h-4 w-4 mr-1" /> Create Campaign
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : !campaigns?.length ? (
        <EmptyState
          title="No campaigns yet"
          description="Create your first campaign to start outreach."
          action={{ label: 'Create Campaign', onClick: () => setCreateOpen(true) }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {campaigns.map((campaign, idx) => (
            <div
              key={campaign.id}
              className="animate-item-entrance"
              style={{ animationDelay: `${idx * 40}ms` }}
            >
              <CampaignCard
                id={campaign.id}
                name={campaign.name}
                market={campaign.market}
                listingType={campaign.listing_type}
                isActive={campaign.is_active}
                dealCount={campaign.deal_count}
                awaitingReviewCount={campaign.awaiting_review_count}
                createdAt={campaign.created_at}
                projectId={projectId}
              />
            </div>
          ))}
        </div>
      )}

      <CreateCampaignDialog open={createOpen} onOpenChange={setCreateOpen} projectId={projectId} />
    </div>
  )
}

export default function CampaignsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params)
  return (
    <Suspense fallback={<div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>}>
      <CampaignsContent projectId={projectId} />
    </Suspense>
  )
}
