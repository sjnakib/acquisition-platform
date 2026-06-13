'use client'

import { useRouter } from 'next/navigation'
import CallQueueTable from '@/components/client/CallQueueTable'

export default function ClientCallsPage() {
  const router = useRouter()

  return (
    <CallQueueTable
      onRowClick={(row) => {
        const dealProjectId = row.deals?.project_id
        if (dealProjectId) {
          router.push(`/projects/${dealProjectId}/calls/${row.deal_id}?callId=${row.id}`)
        }
      }}
    />
  )
}
