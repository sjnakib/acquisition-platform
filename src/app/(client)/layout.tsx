'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { clientNavItems as navItems } from '@/lib/navigation'
import Sidebar from '@/components/shared/Sidebar'

const navSections = [
  { label: 'Client', items: navItems },
]

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <div className="min-h-screen flex">
      <Sidebar
        navSections={navSections}
        profile={{
          avatar: 'C',
          name: 'Client',
          subtitle: <span className="text-[10px]" style={{ color: 'var(--color-sidebar-text-muted)' }}>Client</span>,
        }}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        onLogout={handleLogout}
      />

      {/* Main content */}
      <main
        className="flex-1 overflow-auto transition-all duration-250"
        style={{
          background: 'var(--color-canvas)',
          marginLeft: collapsed ? '52px' : '220px',
          transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div className="pt-8 px-8 pb-8 lg:pt-8 max-lg:px-6 max-md:px-4 max-md:pt-14">
          {children}
        </div>
      </main>
    </div>
  )
}
