'use client'

import { use } from 'react'
import CallQueueTable from '@/components/client/CallQueueTable'
import { useProjectContext } from '@/components/shared/ProjectContext'

export default function InternalClientCallsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params)
  const { projectName } = useProjectContext()
  return (
    <CallQueueTable
      projectId={projectId}
      breadcrumb={[
        { label: 'Projects', href: '/projects' },
        { label: projectName },
        { label: 'Call Queue' },
      ]}
    />
  )
}
