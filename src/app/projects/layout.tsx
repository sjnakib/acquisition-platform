'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
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
  const [role, setRole] = useState<'internal' | 'client' | null>(null)
  const [profileData, setProfileData] = useState<ProfileData | null>(null)
  const [isExiting, setIsExiting] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setRole((user?.app_metadata?.role as 'internal' | 'client') ?? 'internal')
    })
  }, [supabase])

  useEffect(() => {
    const loadProfile = () => {
      fetch('/api/auth/me')
        .then((r) => r.json())
        .then((json) => {
          if (json?.profile) setProfileData(json.profile)
        })
        .catch(() => {})
    }

    loadProfile()
    window.addEventListener('profile-updated', loadProfile)
    return () => window.removeEventListener('profile-updated', loadProfile)
  }, [])

  useEffect(() => {
    if (role === 'internal') {
      fetch('/api/projects')
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setProjects(data)
        })
        .catch(() => {})
    }
  }, [role])

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
