'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, FolderKanban } from 'lucide-react'
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

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
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
      fetch('/api/projects?recent=true&limit=4')
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
    }, 130)
  }

  if (role === null) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--color-canvas)' }}>
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const isClient = role === 'client'
  const navSections = [
    {
      label: 'Global',
      items: [
        { label: 'Projects Hub', icon: FolderKanban, href: '/projects' },
      ],
    },
    ...(!isClient && projects.length > 0
      ? [
          {
            label: 'Projects',
            items: [
              ...projects.map((p) => ({
                label: p.name,
                icon: FolderKanban,
                href: `/projects/${p.id}/dashboard`,
              })),
              ...(projects.length >= 4
                ? [{ label: 'View all projects', icon: ArrowRight, href: '/projects' }]
                : []),
            ],
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
          subtitle: isClient ? 'Sponsor' : (profileData?.role ?? 'Team'),
        }}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapsed}
        onLogout={handleLogout}
      />

      <main
        className="flex-1 overflow-auto transition-all duration-250 lg:ml-[var(--sidebar-width)] ml-0 pt-12 lg:pt-0"
        style={{
          background: 'var(--color-canvas)',
          transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div className="pt-4 px-8 pb-8 max-lg:px-6 max-md:px-4 max-md:pt-2">
          <PageTransition>{children}</PageTransition>
        </div>
      </main>
    </div>
  )
}
