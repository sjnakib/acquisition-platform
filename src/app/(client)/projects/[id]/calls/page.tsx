'use client'

import { use } from 'react'
import CallQueueTable from '@/components/client/CallQueueTable'

export default function ClientCallsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params)
  return <CallQueueTable projectId={projectId} />
}
