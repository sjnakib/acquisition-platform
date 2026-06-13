'use client'

import { use, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { createClient } from '@/lib/supabase/client'

export default function PortfolioByDealPage({ params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = use(params)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('portfolios')
      .select('id')
      .eq('portfolio_deal_id', dealId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          router.replace('/portfolios')
        } else {
          router.replace(`/portfolios/${data.id}`)
        }
      })
  }, [dealId, router])

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <LoadingSpinner size="lg" />
    </div>
  )
}
