'use client'

import { DealsPageView } from '@/components/deals/DealsPageView'
import { pageHeadings } from '@/lib/page-headings'

export default function ClientOverviewPage() {
  return (
    <DealsPageView
      editable={false}
      showToolbar={false}
      columnOrderStorageKey="client-deals"
      title={pageHeadings.activeDeals.title}
      description={pageHeadings.activeDeals.description}
    />
  )
}
