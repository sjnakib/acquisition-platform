'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FolderKanban } from 'lucide-react'
import Sidebar from '@/components/shared/Sidebar'
import { adminNavItems } from '@/lib/navigation'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { PageTransition } from '@/components/shared/PageTransition'
import { useSidebarCollapsed } from '@/lib/hooks/useSidebarCollapsed'

interface ProfileData {
  full_name: string | null
  role: string | null
  avatar_url: string | null
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, toggleCollapsed] = useSidebarCollapsed()
  const [isExiting, setIsExiting] = useState(false)
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: profileData = null } = useQuery<ProfileData | null>({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const res = await fetch('/api/auth/me')
      if (!res.ok) return null
      const json = await res.json()
      return json?.profile ?? null
    },
  })

  // Double-check admin role on mount
  const { data: roleData, isLoading: roleLoading } = useQuery({
    queryKey: ['auth', 'role'],
    queryFn: async () => {
      const res = await fetch('/api/auth/me')
      if (!res.ok) return null
      const json = await res.json()
      return json?.profile?.role ?? null
    },
    staleTime: Infinity,
  })

  async function handleLogout() {
    setIsExiting(true)
    setTimeout(async () => {
      await fetch('/api/auth/logout', { method: 'POST' })
      queryClient.clear()
      router.push('/login')
    }, 130)
  }

  // Redirect non-admin users
  if (!roleLoading && roleData !== 'admin') {
    router.replace('/projects')
    return null
  }

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--color-canvas)' }}>
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const navSections = [
    {
      label: 'Global',
      items: [
        { label: 'Projects Hub', icon: FolderKanban, href: '/projects' },
      ],
    },
    {
      label: 'Admin',
      items: adminNavItems(),
    },
  ]

  return (
    <div className={`min-h-screen flex ${isExiting ? 'animate-page-exit' : ''}`}>
      <Sidebar
        navSections={navSections}
        profile={{
          avatar: (profileData?.full_name ?? 'U').charAt(0).toUpperCase(),
          avatarUrl: profileData?.avatar_url,
          name: profileData?.full_name ?? 'User',
          subtitle: 'Admin',
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
        <div className="pt-8 px-8 pb-8 max-lg:px-6 max-md:px-4 max-md:pt-4">
          <PageTransition>{children}</PageTransition>
        </div>
      </main>
    </div>
  )
}
