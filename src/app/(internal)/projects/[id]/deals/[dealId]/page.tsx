'use client'

import { use } from 'react'
import DealDetailView from '@/components/deals/DealDetailView'

export default function DealDetailPage({ params }: { params: Promise<{ id: string; dealId: string }> }) {
  const { id, dealId } = use(params)
  return (
    <DealDetailView
      projectId={id}
      dealId={dealId}
      backHref={`/projects/${id}/deals`}
      backLabel="Deals"
    />
  )
}
