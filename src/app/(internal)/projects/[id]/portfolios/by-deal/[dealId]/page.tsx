'use client'

import { use, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { createClient } from '@/lib/supabase/client'

/**
 * Resolver page: given a linked deal ID, find the portfolio that owns it
 * and redirect to the portfolio detail page.
 */
export default function PortfolioByDealPage({ params }: { params: Promise<{ id: string; dealId: string }> }) {
  const { id: projectId, dealId } = use(params)
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
          router.replace(`/projects/${projectId}/portfolios`)
        } else {
          router.replace(`/projects/${projectId}/portfolios/${data.id}`)
        }
      })
  }, [projectId, dealId, router])

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <LoadingSpinner size="lg" />
    </div>
  )
}
