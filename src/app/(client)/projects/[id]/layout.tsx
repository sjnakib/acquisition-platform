'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Sidebar from '@/components/shared/Sidebar'
import { ProjectProvider } from '@/components/shared/ProjectContext'
import { clientNavItems } from '@/lib/navigation'
import { ArrowRight, FolderKanban } from 'lucide-react'
import { PageTransition } from '@/components/shared/PageTransition'
import { useSidebarCollapsed } from '@/lib/hooks/useSidebarCollapsed'

interface ProfileData {
  full_name: string | null
  role: string | null
  avatar_url: string | null
}

export default function ClientProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id: projectId } = use(params)
  const [collapsed, toggleCollapsed] = useSidebarCollapsed()
  const [isExiting, setIsExiting] = useState(false)
  const router = useRouter()

  const { data: projectData, error: projectError } = useQuery<{ name?: string }>({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`)
      if (res.status === 404) throw new Error('NOT_FOUND')
      if (!res.ok) throw new Error('Failed to fetch project')
      return res.json()
    },
    retry: (failureCount, error) => {
      if (error.message === 'NOT_FOUND') return false
      return failureCount < 2
    },
  })

  useEffect(() => {
    if (projectError && (projectError as Error).message === 'NOT_FOUND') {
      router.push('/projects')
    }
  }, [projectError, router])

  const projectName: string = projectData?.name ?? (projectData === undefined ? 'Loading...' : 'Error loading project')

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
    queryKey: ['projects', 'recent'],
    queryFn: async () => {
      const res = await fetch('/api/projects?recent=true&limit=4')
      if (!res.ok) return []
      const data = await res.json()
      return Array.isArray(data) ? data : []
    },
  })

  useEffect(() => {
    fetch(`/api/projects/${projectId}/access`, { method: 'POST' }).catch(() => {})
  }, [projectId])

  async function handleLogout() {
    setIsExiting(true)
    setTimeout(async () => {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
    }, 130)
  }

  const navItems = clientNavItems(projectId)
  const otherProjects = projects.filter((p) => p.id !== projectId)

  const navSections = [
    {
      label: 'Global',
      items: [
        { label: 'Projects Hub', icon: FolderKanban, href: '/projects' },
      ],
    },
    { label: projectName, items: navItems },
    ...(projects.length > 1
      ? [
          {
            label: 'Switch Project',
            items: [
              ...otherProjects.map((p) => ({
                label: p.name,
                icon: FolderKanban,
                href: `/projects/${p.id}/overview`,
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
          avatar: (profileData?.full_name ?? 'C').charAt(0).toUpperCase(),
          avatarUrl: profileData?.avatar_url,
          name: profileData?.full_name ?? 'Client',
          subtitle: 'Sponsor',
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
        <div className="pt-4 px-8 pb-8 max-lg:px-6 max-md:px-4 max-md:pt-2">
          <ProjectProvider projectId={projectId} projectName={projectName}>
            <PageTransition>{children}</PageTransition>
          </ProjectProvider>
        </div>
      </main>
    </div>
  )
}
