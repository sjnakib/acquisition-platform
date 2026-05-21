'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FolderKanban } from 'lucide-react'
import Sidebar from '@/components/shared/Sidebar'
import { createClient } from '@/lib/supabase/client'

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [role, setRole] = useState<'internal' | 'client' | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setRole((user?.app_metadata?.role as 'internal' | 'client') ?? 'internal')
    })
  }, [supabase])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  // Client role: no sidebar, just the selector UI
  if (role === 'client') {
    return <>{children}</>
  }

  // Internal role: sidebar with projects nav
  const navSections = [
    {
      label: 'Workspace',
      items: [
        { label: 'Projects', icon: FolderKanban, href: '/projects' },
      ],
    },
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
        {children}
      </main>
    </div>
  )
}
