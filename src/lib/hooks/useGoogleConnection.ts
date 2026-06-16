'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { toast } from 'sonner'

export type GoogleConnectionStatus = 'connected' | 'expired' | 'disconnected'

export interface GoogleConnectionState {
  status: GoogleConnectionStatus
  googleEmail: string | null
  /** URL to initiate OAuth reconnect (already includes projectId or type=system). */
  reconnectUrl: string | null
  disconnect: () => Promise<void>
}

/** Internal query data shape — disconnect is attached after useQuery. */
interface GoogleConnectionQueryData {
  status: GoogleConnectionStatus
  googleEmail: string | null
  reconnectUrl: string | null
}

/**
 * Shared hook for Google connection state (project or system).
 *
 * - Call with a `projectId` for project-scoped connections.
 * - Call with no arguments for the system-wide connection (admin only).
 *
 * Returns three-state status so the UI can distinguish:
 *   connected  — tokens present, Google APIs should work
 *   expired    — row exists but tokens were nullified (invalid_grant)
 *   disconnected — no google_connections row at all
 */
export function useGoogleConnection(projectId?: string): GoogleConnectionState {
  const queryClient = useQueryClient()
  const isSystem = !projectId

  const queryKey = isSystem
    ? ['google-connection', 'system'] as const
    : ['google-connection', projectId] as const

  const { data } = useQuery<GoogleConnectionQueryData>({
    queryKey,
    queryFn: async (): Promise<GoogleConnectionQueryData> => {
      if (isSystem) {
        const res = await fetch('/api/admin/system-email')
        if (!res.ok) return disconnected()
        const json = await res.json()
        if (!json.connected) return disconnected()
        return {
          status: json.token_valid === false ? 'expired' : 'connected',
          googleEmail: json.google_email ?? null,
          reconnectUrl: '/api/auth/google?type=system',
        }
      }

      const res = await fetch(`/api/projects/${projectId}`)
      if (!res.ok) return disconnected()
      const json = await res.json()
      const conn = json.google_connections
      if (!conn) return disconnected()
      return {
        status: conn.token_valid === false ? 'expired' : 'connected',
        googleEmail: conn.google_email ?? null,
        reconnectUrl: `/api/auth/google?projectId=${projectId}`,
      }
    },
    staleTime: 30_000,
    retry: false,
  })

  const disconnect = useCallback(async () => {
    try {
      if (isSystem) {
        const res = await fetch('/api/admin/system-email', { method: 'DELETE' })
        if (!res.ok) throw new Error('Failed to disconnect')
      } else {
        const res = await fetch(`/api/projects/${projectId}/google/disconnect`, { method: 'POST' })
        if (!res.ok) throw new Error('Failed to disconnect')
      }
      queryClient.invalidateQueries({ queryKey })
      toast.success('Google account disconnected.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to disconnect')
      throw err
    }
  }, [isSystem, projectId, queryClient, queryKey])

  if (data) {
    return { ...data, disconnect }
  }

  return { ...disconnected(), disconnect }
}

function disconnected(): GoogleConnectionQueryData {
  return { status: 'disconnected', googleEmail: null, reconnectUrl: null }
}
