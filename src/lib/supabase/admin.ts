import { createClient as createSupabaseClient, type User } from '@supabase/supabase-js'

export function createAdminClient() {
  if (typeof window !== 'undefined') {
    throw new Error('Admin client cannot be used in browser context')
  }
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

/**
 * Fetch ALL auth users by paginating through listUsers().
 * The GoTrue admin API defaults to page size ~100 and does not return
 * all users in a single call. Every call site that needs the full user
 * list or needs to find a user by email must use this instead of the
 * raw listUsers() to avoid silently missing users beyond page 1.
 */
export async function listAllUsers(): Promise<User[]> {
  const admin = createAdminClient()
  const allUsers: User[] = []
  let page = 1
  const perPage = 100

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    if (!data?.users?.length) break
    allUsers.push(...data.users)
    if (data.users.length < perPage) break
    page++
  }

  return allUsers
}

/**
 * Verify whether a user exists by email.
 * Uses the RPC function find_user_by_email for an O(1) indexed lookup.
 * Falls back to paginated listUsers() if RPC fails.
 * Returns { exists: true, userId } if found, { exists: false } if not.
 */
export async function verifyUserExistsByEmail(
  email: string,
): Promise<{ exists: boolean; userId?: string }> {
  const admin = createAdminClient()
  const normalizedEmail = email.toLowerCase().trim()
  
  const { data, error } = await admin.rpc('find_user_by_email', { p_email: normalizedEmail })
  if (error) {
    console.error('[verifyUserExistsByEmail] RPC find_user_by_email error, falling back to scan:', error)
    
    let page = 1
    const perPage = 100

    while (true) {
      const { data: listData, error: listErr } = await admin.auth.admin.listUsers({ page, perPage })
      if (listErr) {
        console.error('[verifyUserExistsByEmail] listUsers fallback error:', listErr)
        return { exists: false }
      }
      if (!listData?.users?.length) break

      const found = listData.users.find(
        (u) => u.email?.toLowerCase() === normalizedEmail,
      )
      if (found) {
        return { exists: true, userId: found.id }
      }

      if (listData.users.length < perPage) break
      page++
    }
    return { exists: false }
  }

  if (data && data.length > 0) {
    return { exists: true, userId: data[0].user_id }
  }
  return { exists: false }
}

/**
 * Batch fetch email addresses for a specific list of user IDs.
 * Uses the RPC function get_user_emails to perform a single indexed lookup,
 * avoiding paginating through all auth users.
 */
export async function fetchUserEmails(userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map()
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('get_user_emails', { p_user_ids: userIds })
  if (error) {
    console.error('[fetchUserEmails] RPC error, falling back to paginated listAllUsers:', error)
    const users = await listAllUsers()
    return new Map(users.filter((u) => userIds.includes(u.id)).map((u) => [u.id, u.email ?? '']))
  }
  return new Map((data as Array<{ user_id: string; user_email: string }>)?.map((row) => [row.user_id, row.user_email]) ?? [])
}
