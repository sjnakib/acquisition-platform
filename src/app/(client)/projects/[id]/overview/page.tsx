'use client'

import { use } from 'react'
import ActiveDealsTable from '@/components/client/ActiveDealsTable'

export default function ClientOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params)
  return <ActiveDealsTable projectId={projectId} />
}
