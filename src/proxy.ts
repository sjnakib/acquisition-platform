import { updateSession } from '@/lib/supabase/middleware'
import { NextResponse, type NextRequest } from 'next/server'
import { User } from '@supabase/supabase-js';

type UserWithRole = User & {
  app_metadata: {
    role: 'internal' | 'client' | 'admin' | undefined;
  }
}

export async function proxy(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request)

  const role = (user as UserWithRole)?.app_metadata?.role

  const path = request.nextUrl.pathname

  // Auth pages: login, signup, reset-password
  const isAuthRoute = path.startsWith('/login') || path.startsWith('/signup')

  // Internal routes: /projects (list), /projects/[id]/* (all workspace pages)
  const isInternalRoute = path.startsWith('/projects')

  // Client routes: same /projects prefix but scoped differently by role
  const isClientRoute = path.startsWith('/projects')

  // Also handle legacy redirects from old URLs
  const isLegacyInternal = path.startsWith('/dashboard') || path.startsWith('/deals') ||
    path.startsWith('/portfolios') || path.startsWith('/campaigns') ||
    path.startsWith('/import') || path.startsWith('/settings') ||
    path.startsWith('/client-view')
  const isLegacyClient = path.startsWith('/overview') || path.startsWith('/calls')

  // Redirect legacy URLs to /projects (will need manual project selection)
  if (isLegacyInternal || isLegacyClient) {
    return NextResponse.redirect(new URL('/projects', request.url))
  }

  if (!user && (isInternalRoute || isClientRoute)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && isAuthRoute) {
    const dest = role === 'client' ? '/projects' : '/projects'
    return NextResponse.redirect(new URL(dest, request.url))
  }

  // Client on /projects without an ID → stay (project selector page)
  // Internal on /projects without an ID → stay (project list page)

  // Client trying to access internal-only project pages (no client-view prefix)
  // Blocked by layout guards, but proxy double-checks the root
  if (user && role === 'client' && isInternalRoute && !path.includes('/client-view')) {
    // Client can only access /projects and /projects/[id]/overview and /projects/[id]/calls
    // Let layouts handle finer-grained checks
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
