'use client'

import { useEffect, useRef } from 'react'
import { CoStarImportWizard } from '@/components/import/CoStarImportWizard'
import { PageHeader } from '@/components/shared/PageHeader'
import { pageHeadings } from '@/lib/page-headings'

export default function ImportPage() {
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
  }, [])

  return (
    <div ref={containerRef}>
      <div ref={headerRef}>
        <PageHeader
          title={pageHeadings.import.title}
          description={pageHeadings.import.description}
        />
      </div>
      <CoStarImportWizard />
    </div>
  )
}

