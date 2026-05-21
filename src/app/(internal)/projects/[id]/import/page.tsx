'use client'

import { use } from 'react'
import { CoStarImportWizard } from '@/components/import/CoStarImportWizard'
import { PageHeader } from '@/components/shared/PageHeader'
import { useProjectContext } from '@/components/shared/ProjectContext'
import { pageHeadings } from '@/lib/page-headings'

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
      <CoStarImportWizard />
    </div>
  )
}
