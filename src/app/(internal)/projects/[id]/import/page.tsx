'use client'

import { use, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { CoStarImportWizard } from '@/components/import/CoStarImportWizard'
import { PageHeader } from '@/components/shared/PageHeader'
import { useProjectContext } from '@/components/shared/ProjectContext'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { pageHeadings } from '@/lib/page-headings'

function ImportWizardWithPreSelect({ projectId }: { projectId: string }) {
  const searchParams = useSearchParams()
  const campaignId = searchParams.get('campaignId') ?? undefined

  return <CoStarImportWizard projectId={projectId} defaultCampaignId={campaignId} />
}

export default function ImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params)
  const { projectName } = useProjectContext()

  return (
    <div>
      <PageHeader
        title={pageHeadings.import.title}
        description={pageHeadings.import.description}
        breadcrumb={[
          { label: 'Projects', href: '/projects' },
          { label: projectName, href: `/projects/${projectId}/import` },
          { label: 'Import' },
        ]}
      />
      <Suspense fallback={<LoadingSpinner size="lg" />}>
        <ImportWizardWithPreSelect projectId={projectId} />
      </Suspense>
    </div>
  )
}
