'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/shared/Sidebar'
import { ProjectProvider } from '@/components/shared/ProjectContext'
import { internalNavItems, clientNavItems } from '@/lib/navigation'
import { FolderKanban } from 'lucide-react'

interface ProfileData {
  full_name: string | null
  role: string | null
  avatar_url: string | null
}

export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id: projectId } = use(params)
  const [collapsed, setCollapsed] = useState(false)
  const [projectName, setProjectName] = useState('Loading...')
  const [profileData, setProfileData] = useState<ProfileData | null>(null)
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([])
  const router = useRouter()

  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.name) setProjectName(data.name)
        else if (data?.error) router.push('/projects')
      })
      .catch(() => router.push('/projects'))
  }, [projectId, router])

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
    fetch('/api/projects')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setProjects(data)
      })
      .catch(() => {})
  }, [])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const navItems = internalNavItems(projectId)
  const internalClientViewItems = [
    { label: 'Active Deals', icon: clientNavItems(projectId)[0]!.icon, href: `/projects/${projectId}/client-view/overview` },
    { label: 'Call Queue',   icon: clientNavItems(projectId)[1]!.icon, href: `/projects/${projectId}/client-view/calls` },
  ]

  const navSections = [
    {
      label: 'Global',
      items: [
        { label: 'Projects Hub', icon: FolderKanban, href: '/projects' },
      ],
    },
    {
      label: projectName,
      items: navItems,
    },
    ...(projects.length > 1
      ? [
          {
            label: 'Switch Project',
            items: projects
              .filter((p) => p.id !== projectId)
              .map((p) => ({
                label: p.name,
                icon: FolderKanban,
                href: `/projects/${p.id}/dashboard`,
              })),
          },
        ]
      : []),
    { label: 'Client View', items: internalClientViewItems },
  ]

  return (
    <div className="min-h-screen flex">
      <Sidebar
        navSections={navSections}
        profile={{
          avatar: (profileData?.full_name ?? 'U').charAt(0).toUpperCase(),
          avatarUrl: profileData?.avatar_url,
          name: profileData?.full_name ?? 'User',
          subtitle: profileData?.role ?? 'Team',
        }}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
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
            {children}
          </ProjectProvider>
        </div>
      </main>
    </div>
  )
}
