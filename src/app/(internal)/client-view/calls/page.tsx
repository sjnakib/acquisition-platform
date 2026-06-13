'use client'

import { useRouter } from 'next/navigation'
import CallQueueTable from '@/components/client/CallQueueTable'

export default function InternalClientCallsPage() {
  const router = useRouter()

  return (
    <CallQueueTable
      onRowClick={(row) => {
        const dealProjectId = row.deals?.project_id
        if (dealProjectId) {
          router.push(`/projects/${dealProjectId}/deals/${row.deal_id}?tab=calls&callId=${row.id}`)
        }
      }}
    />
  )
}
