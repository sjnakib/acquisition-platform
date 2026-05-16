'use client'

import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { DealTable } from '@/components/deals/DealTable'
import { pageHeadings } from '@/lib/page-headings'

interface Deal {
 id: string
 deal_name: string | null
 address: string | null
 city: string | null
 state: string | null
 unit_count: number | null
 stage: string
 score: string | null
 created_at: string
 campaigns: { name: string; market: string } | null
}

export default function DealsPage() {
 const [deals, setDeals] = useState<Deal[]>([])
 const [loading, setLoading] = useState(true)

 useEffect(() => {
 fetch('/api/deals')
 .then((res) => res.json())
 .then((data) => setDeals(data))
 .catch(console.error)
 .finally(() => setLoading(false))
 }, [])

 return (
 <div>
 <PageHeader title={pageHeadings.deals.title} description={loading ? 'Loading...' : `${deals.length} deals in pipeline`} />
 <DealTable deals={deals} loading={loading} />
 </div>
 )
}
