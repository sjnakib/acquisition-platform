'use client'

import { use } from 'react'
import { DealsPageView } from '@/components/deals/DealsPageView'
import { useProjectContext } from '@/components/shared/ProjectContext'
import { pageHeadings } from '@/lib/page-headings'

export default function InternalClientOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params)
  const { projectName } = useProjectContext()

  return (
    <DealsPageView
      projectId={projectId}
      editable={false}
      showToolbar={false}
      columnOrderStorageKey={`internal-client-deals-${projectId}`}
      title={pageHeadings.activeDeals.title}
      description={pageHeadings.activeDeals.description}
      breadcrumb={[
        { label: 'Projects', href: '/projects' },
        { label: projectName },
        { label: 'Active Deals' },
      ]}
    />
  )
}
