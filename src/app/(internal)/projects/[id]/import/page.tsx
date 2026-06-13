'use client'

import { use, Suspense, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { CoStarImportWizard } from '@/components/import/CoStarImportWizard'
import { PageHeader } from '@/components/shared/PageHeader'
import { useProjectContext } from '@/components/shared/ProjectContext'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { pageHeadings } from '@/lib/page-headings'

function ImportWizardWithPreSelect({
  projectId,
}: {
  projectId: string
}) {
  const searchParams = useSearchParams()
  const campaignId = searchParams.get('campaignId') ?? undefined

  return (
    <CoStarImportWizard
      projectId={projectId}
      defaultCampaignId={campaignId}
    />
  )
}

export default function ImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params)
  const { projectName } = useProjectContext()
  const headerRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (headerRef.current && containerRef.current) {
      const header = headerRef.current
      const container = containerRef.current

      const updateHeight = () => {
        container.style.setProperty('--header-height', `${header.offsetHeight}px`)
      }

      updateHeight()

      const ro = new ResizeObserver(updateHeight)
      ro.observe(header)
      return () => ro.disconnect()
    }
  }, [projectName])

  return (
    <div ref={containerRef}>
      <div ref={headerRef}>
        <PageHeader
          title={pageHeadings.import.title}
          description={pageHeadings.import.description}
          breadcrumb={[
            { label: 'Projects', href: '/projects' },
            { label: projectName, href: `/projects/${projectId}/import` },
            { label: 'Import' },
          ]}
        />
      </div>
      <Suspense fallback={<LoadingSpinner size="lg" />}>
        <ImportWizardWithPreSelect projectId={projectId} />
      </Suspense>
    </div>
  )
}

