// In-memory OAuth2 client cache to avoid hitting Supabase on every Drive API call.
// Cached per connectionId with a 5-minute TTL. Invalidated on token refresh.

import type { OAuth2Client } from 'google-auth-library'

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

interface CacheEntry {
  client: OAuth2Client
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()

/** Return a cached OAuth2 client if still valid, otherwise null. */
export function getCachedClient(connectionId: string): OAuth2Client | null {
  const entry = cache.get(connectionId)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(connectionId)
    return null
  }
  return entry.client
}

/** Store an OAuth2 client in the cache. */
export function setCachedClient(connectionId: string, client: OAuth2Client): void {
  cache.set(connectionId, {
    client,
    expiresAt: Date.now() + CACHE_TTL_MS,
  })
}

/** Remove a cached client (called on token refresh or connection change). */
export function invalidateCachedClient(connectionId: string): void {
  cache.delete(connectionId)
}
