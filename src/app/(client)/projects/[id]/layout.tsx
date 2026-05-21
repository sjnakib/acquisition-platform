'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/shared/Sidebar'
import { clientNavItems } from '@/lib/navigation'

export default function ClientProjectLayout({
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

  const navItems = clientNavItems(projectId)
  const navSections = [{ label: projectName, items: navItems }]

  return (
    <div className="min-h-screen flex">
      <Sidebar
        navSections={navSections}
        profile={{
          avatar: 'C',
          name: 'Client',
          subtitle: <span className="text-[10px]" style={{ color: 'var(--color-sidebar-text-muted)' }}>Sponsor</span>,
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
        <div
          className="flex items-center gap-2 px-8 pt-4 pb-0 text-xs border-b"
          style={{
            borderColor: 'var(--color-border)',
            background: 'var(--color-surface-0)',
          }}
        >
          <a href="/projects" className="hover:underline" style={{ color: 'var(--color-text-secondary)' }}>
            Projects
          </a>
          <span style={{ color: 'var(--color-text-tertiary)' }}>/</span>
          <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{projectName}</span>
        </div>

        <div className="pt-4 px-8 pb-8 max-lg:px-6 max-md:px-4 max-md:pt-2">
          {children}
        </div>
      </main>
    </div>
  )
}
