'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import CallQueueTable from '@/components/client/CallQueueTable'
import { useProjectContext } from '@/components/shared/ProjectContext'

export default function ClientCallsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params)
  const { projectName } = useProjectContext()
  const router = useRouter()

  return (
    <CallQueueTable
      projectId={projectId}
      breadcrumb={[
        { label: 'Projects', href: '/projects' },
        { label: projectName },
        { label: 'Call Queue' },
      ]}
      onRowClick={(row) => router.push(`/projects/${projectId}/calls/${row.deal_id}?callId=${row.id}`)}
    />
  )
}
