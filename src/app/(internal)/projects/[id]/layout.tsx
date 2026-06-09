'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/shared/Sidebar'
import { ProjectProvider } from '@/components/shared/ProjectContext'
import { internalNavItems, clientNavItems } from '@/lib/navigation'
import { ArrowRight, FolderKanban } from 'lucide-react'
import { PageTransition } from '@/components/shared/PageTransition'

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
  const [isExiting, setIsExiting] = useState(false)
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    fetch(`/api/projects/${projectId}`)
      .then(async (r) => {
        const data = await r.json()
        if (cancelled) return
        if (data?.name) {
          setProjectName(data.name)
        } else if (!r.ok && r.status === 404) {
          // Project genuinely doesn't exist — navigate away
          router.push('/projects')
        } else {
          // Server error, network issue, etc. — show error, don't redirect
          setProjectName('Error loading project')
        }
      })
      .catch(() => {
        if (!cancelled) setProjectName('Error loading project')
      })
    return () => { cancelled = true }
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
    const handle = (e: Event) => {
      const name = (e as CustomEvent<{ name: string }>).detail?.name
      if (name) setProjectName(name)
    }
    window.addEventListener('project-updated', handle)
    return () => window.removeEventListener('project-updated', handle)
  }, [])

  useEffect(() => {
    fetch(`/api/projects/${projectId}/access`, { method: 'POST' }).catch(() => {})
  }, [projectId])

  useEffect(() => {
    fetch('/api/projects?recent=true&limit=4')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setProjects(data)
      })
      .catch(() => {})
  }, [projectId])

  async function handleLogout() {
    setIsExiting(true)
    setTimeout(async () => {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
    }, 130)
  }

  const isClient = profileData?.role === 'client'

  const navItems = isClient ? clientNavItems(projectId) : internalNavItems(projectId)

  // Internal users see a "Client View" section to preview the sponsor perspective
  const internalClientViewItems = !isClient ? [
    { label: 'Active Deals', icon: clientNavItems(projectId)[0]!.icon, href: `/projects/${projectId}/client-view/overview` },
    { label: 'Call Queue',   icon: clientNavItems(projectId)[1]!.icon, href: `/projects/${projectId}/client-view/calls` },
  ] : []

  const otherProjects = projects.filter((p) => p.id !== projectId)

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
            items: [
              ...otherProjects.map((p) => ({
                label: p.name,
                icon: FolderKanban,
                href: isClient ? `/projects/${p.id}/overview` : `/projects/${p.id}/dashboard`,
              })),
              ...(projects.length >= 4
                ? [{ label: 'View all projects', icon: ArrowRight, href: '/projects' }]
                : []),
            ],
          },
        ]
      : []),
    ...(internalClientViewItems.length > 0
      ? [{ label: 'Client View', items: internalClientViewItems }]
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
        <div className="pt-8 px-8 pb-8 max-lg:px-6 max-md:px-4 max-md:pt-4">
          <ProjectProvider projectId={projectId} projectName={projectName}>
            <PageTransition>{children}</PageTransition>
          </ProjectProvider>
        </div>
      </main>
    </div>
  )
}
