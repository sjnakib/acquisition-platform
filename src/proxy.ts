import { updateSession } from '@/lib/supabase/middleware'
import { NextResponse, type NextRequest } from 'next/server'
import { User } from '@supabase/supabase-js';

type UserWithRole = User & {
  app_metadata: {
    role: 'internal' | 'client' | undefined;
  }
}

export async function proxy(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request)

  const role = (user as UserWithRole)?.app_metadata?.role


  const path = request.nextUrl.pathname
  const isAuthRoute     = path.startsWith('/login') || path.startsWith('/signup')
  const isInternalRoute = path.startsWith('/dashboard') || path.startsWith('/deals') ||
                          path.startsWith('/portfolios') || path.startsWith('/campaigns') ||
                          path.startsWith('/import') || path.startsWith('/settings') ||
                          path.startsWith('/client-view')
  const isClientRoute   = path.startsWith('/overview') || path.startsWith('/calls')

  if (!user && (isInternalRoute || isClientRoute)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && isAuthRoute) {
    const dest = role === 'client' ? '/overview' : '/dashboard'
    return NextResponse.redirect(new URL(dest, request.url))
  }

  if (user && isClientRoute && role !== 'client') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
  if (user && isInternalRoute && role !== 'internal') {
    return NextResponse.redirect(new URL('/overview', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
