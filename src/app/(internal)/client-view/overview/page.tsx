'use client'

import { DealsPageView } from '@/components/deals/DealsPageView'
import { pageHeadings } from '@/lib/page-headings'

export default function InternalClientOverviewPage() {
  return (
    <DealsPageView
      editable={false}
      showToolbar={false}
      columnOrderStorageKey="internal-client-deals"
      title={pageHeadings.activeDeals.title}
      description={pageHeadings.activeDeals.description}
    />
  )
}
