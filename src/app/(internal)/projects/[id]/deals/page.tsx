'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { DealsPageView, type Deal } from '@/components/deals/DealsPageView'
import { useProjectContext } from '@/components/shared/ProjectContext'

export default function DealsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params)
  const { projectName } = useProjectContext()
  const router = useRouter()

  return (
    <DealsPageView
      projectId={projectId}
      columnOrderStorageKey={`deals-table-${projectId}`}
      breadcrumb={[
        { label: 'Projects', href: '/projects' },
        { label: projectName, href: `/projects/${projectId}/deals` },
      ]}
      onRowClick={(deal: Deal) => router.push(`/projects/${projectId}/deals/${deal.id}`)}
    />
  )
}
