'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/shared/Sidebar'
import { ProjectProvider } from '@/components/shared/ProjectContext'
import { internalNavItems, clientNavItems } from '@/lib/navigation'

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
    { label: 'Workspace', items: navItems },
    { label: 'Client View', items: internalClientViewItems },
  ]

  return (
    <div className="min-h-screen flex">
      <Sidebar
        navSections={navSections}
        profile={{
          avatar: 'U',
          name: 'User',
          subtitle: <span className="text-[10px]" style={{ color: 'var(--color-sidebar-text-muted)' }}>Team</span>,
        }}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        onLogout={handleLogout}
      />

      <main
        className="flex-1 overflow-auto transition-all duration-250"
        style={{
          background: 'var(--color-canvas)',
          marginLeft: collapsed ? '52px' : '220px',
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
