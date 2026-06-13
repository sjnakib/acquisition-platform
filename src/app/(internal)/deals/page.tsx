'use client'

import { Suspense } from 'react'
import { DealsPageView } from '@/components/deals/DealsPageView'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

export default function DealsPage() {
  return (
    <Suspense fallback={<LoadingSpinner size="lg" />}>
      <DealsPageView columnOrderStorageKey="deals-table" />
    </Suspense>
  )
}
