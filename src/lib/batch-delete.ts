/** Delete specific deal IDs in a single request. Server chunks internally. */
export async function batchDeleteDeals(ids: string[]): Promise<number> {
  const res = await fetch('/api/deals/batch', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? 'Batch delete failed')
  }
  const data = await res.json()
  return data.deleted as number
}

/** Delete all deals matching filter params. No ID round-trip needed. */
export async function deleteAllDeals(params: {
  campaign_id?: string
  stage?: string
  score?: string
  search?: string
}): Promise<number> {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v)
  }
  const res = await fetch(`/api/deals?${sp.toString()}`, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? 'Delete all failed')
  }
  const data = await res.json()
  return data.deleted as number
}
