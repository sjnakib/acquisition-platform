'use client'

import { Suspense } from 'react'
import { DealsPageView } from '@/components/deals/DealsPageView'
import { pageHeadings } from '@/lib/page-headings'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

export default function ClientOverviewPage() {
  return (
    <Suspense fallback={<LoadingSpinner size="lg" />}>
      <DealsPageView
        editable={false}
        showToolbar={false}
        columnOrderStorageKey="client-deals"
        title={pageHeadings.activeDeals.title}
        description={pageHeadings.activeDeals.description}
      />
    </Suspense>
  )
}
