'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { FolderKanban } from 'lucide-react'
import Sidebar from '@/components/shared/Sidebar'
import { createClient } from '@/lib/supabase/client'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { PageTransition } from '@/components/shared/PageTransition'
import { useSidebarCollapsed } from '@/lib/hooks/useSidebarCollapsed'

interface ProfileData {
  full_name: string | null
  role: string | null
  avatar_url: string | null
}

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [collapsed, toggleCollapsed] = useSidebarCollapsed()
  const [isExiting, setIsExiting] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const { data: roleData } = useQuery({
    queryKey: ['auth', 'role'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      return (user?.app_metadata?.role as 'internal' | 'client') ?? 'internal'
    },
    staleTime: Infinity,
  })
  const role = roleData ?? null

  const { data: profileData = null } = useQuery<ProfileData | null>({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const res = await fetch('/api/auth/me')
      if (!res.ok) return null
      const json = await res.json()
      return json?.profile ?? null
    },
  })

  const { data: projects = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['projects', 'all'],
    queryFn: async () => {
      const res = await fetch('/api/projects')
      if (!res.ok) return []
      const data = await res.json()
      return Array.isArray(data) ? data : []
    },
    enabled: role === 'internal',
  })

  async function handleLogout() {
    setIsExiting(true)
    setTimeout(async () => {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
    }, 200)
  }

  // If we are on a project-specific route, let the project-specific layout handle it
  if (pathname !== '/projects') {
    return <>{children}</>
  }

  // Gating layout rendering until user role resolves to prevent layout flash/FOUC
  if (role === null) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--color-canvas)' }}>
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // Client role: no sidebar, just the selector UI
  if (role === 'client') {
    return <>{children}</>
  }

  // Internal role: sidebar with projects nav
  const navSections = [
    {
      label: 'Global',
      items: [
        { label: 'Projects Hub', icon: FolderKanban, href: '/projects' },
      ],
    },
    ...(projects.length > 0
      ? [
          {
            label: 'Projects',
            items: projects.map((p) => ({
              label: p.name,
              icon: FolderKanban,
              href: `/projects/${p.id}/dashboard`,
            })),
          },
        ]
      : []),
  ]

  return (
    <div className={`min-h-screen flex ${isExiting ? 'animate-page-exit' : ''}`}>
      <Sidebar
        navSections={navSections}
        profile={{
          avatar: (profileData?.full_name ?? 'U').charAt(0).toUpperCase(),
          avatarUrl: profileData?.avatar_url,
          name: profileData?.full_name ?? 'User',
          subtitle: profileData?.role ?? 'Team',
        }}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapsed}
        onLogout={handleLogout}
      />

      <main
        className="flex-1 overflow-auto transition-all duration-250"
        style={{
          background: 'var(--color-canvas)',
          marginLeft: 'var(--sidebar-width)',
          transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  )
}
