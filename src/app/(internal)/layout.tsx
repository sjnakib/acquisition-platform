'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard, Building2, Megaphone, Upload, Settings, FolderKanban,
} from 'lucide-react'
import { clientNavItems } from '@/lib/navigation'
import Sidebar from '@/components/shared/Sidebar'

const internalClientViewItems = clientNavItems.map((item) => ({
  ...item,
  href: `/client-view${item.href}`,
}))

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { label: 'Deals', icon: Building2, href: '/deals' },
  { label: 'Portfolios', icon: FolderKanban, href: '/portfolios' },
  { label: 'Campaigns', icon: Megaphone, href: '/campaigns' },
  { label: 'Import', icon: Upload, href: '/import' },
  { label: 'Settings', icon: Settings, href: '/settings' },
]

const navSections = [
  { label: 'Workspace', items: navItems },
  { label: 'Client View', items: internalClientViewItems },
]

export default function InternalLayout({ children }: { children: React.ReactNode }) {
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
          avatar: 'U',
          name: 'User',
          subtitle: <span className="text-[10px]" style={{ color: 'var(--color-sidebar-text-muted)' }}>Team</span>,
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
