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
 * Uses paginated listUsers() to search through ALL auth users.
 * Returns { exists: true, userId } if found, { exists: false } if not.
 * This is the single source of truth for email-based user existence checks.
 */
export async function verifyUserExistsByEmail(
  email: string,
): Promise<{ exists: boolean; userId?: string }> {
  const admin = createAdminClient()
  const normalizedEmail = email.toLowerCase()
  let page = 1
  const perPage = 100

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) {
      console.error('[verifyUserExistsByEmail] listUsers error:', error)
      return { exists: false }
    }
    if (!data?.users?.length) break

    const found = data.users.find(
      (u) => u.email?.toLowerCase() === normalizedEmail,
    )
    if (found) {
      return { exists: true, userId: found.id }
    }

    if (data.users.length < perPage) break
    page++
  }

  return { exists: false }
}
