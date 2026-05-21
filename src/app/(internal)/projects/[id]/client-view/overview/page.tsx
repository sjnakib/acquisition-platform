'use client'

import { use } from 'react'
import ActiveDealsTable from '@/components/client/ActiveDealsTable'
import { useProjectContext } from '@/components/shared/ProjectContext'

export default function InternalClientOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params)
  const { projectName } = useProjectContext()
  return (
    <ActiveDealsTable
      projectId={projectId}
      breadcrumb={[
        { label: 'Projects', href: '/projects' },
        { label: projectName },
        { label: 'Active Deals' },
      ]}
    />
  )
}
