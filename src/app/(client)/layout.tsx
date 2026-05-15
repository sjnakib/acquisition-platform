'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, Phone, ChevronLeft, ChevronRight, Menu, LogOut, X } from 'lucide-react'

const navItems = [
  { label: 'Active Deals', icon: LayoutDashboard, href: '/overview' },
  { label: 'Call Queue', icon: Phone, href: '/calls' },
]

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex flex-col fixed left-0 top-0 h-full border-r transition-all duration-250 ${collapsed ? 'w-[52px]' : 'w-[220px]'}`}
        style={{
          background: '#0E0E0E',
          borderColor: '#1A1A1A',
          transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div className="flex items-center h-[52px] px-4 border-b" style={{ borderColor: '#1A1A1A', borderBottom: '1px solid rgba(200, 150, 60, 0.15)' }}>
          <div className="flex items-center gap-2">
            <span className="text-lg" style={{ color: 'var(--accent)' }}>◆</span>
            {!collapsed && <span className="text-[15px] font-medium" style={{ color: '#F0EDE8', fontFamily: 'var(--font-dm-sans)' }}>Acquire</span>}
          </div>
        </div>

        <nav className="flex-1 py-3 px-2 space-y-0.5">
          <div className="text-[9px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 select-none" style={{ color: '#3D3D3B' }}>
            {!collapsed && 'Client'}
          </div>
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 h-[34px] px-3 mx-0.5 rounded-md text-[13px] font-normal transition-all duration-150 no-underline whitespace-nowrap"
                style={{
                  color: isActive ? '#F7F5F0' : '#A8A39A',
                  background: isActive ? '#242424' : 'transparent',
                  fontWeight: isActive ? 500 : 400,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) { e.currentTarget.style.background = '#1A1A1A'; e.currentTarget.style.color = '#D4D0C8' }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#A8A39A' }
                }}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" style={{ opacity: isActive ? 1 : 0.7 }} />
                {!collapsed && item.label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t" style={{ borderColor: '#1A1A1A' }}>
          <div className="p-2">
            <div className="flex items-center gap-3 px-3 py-2 rounded-md">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0" style={{ background: 'var(--color-accent-muted)', color: 'var(--color-accent-light)' }}>C</div>
              {!collapsed && (
                <div className="flex-1 text-left leading-tight">
                  <div className="text-[13px] font-medium" style={{ color: '#D4D0C8' }}>Client</div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px]" style={{ color: '#5C5750' }}>Client</span>
                    <span className="text-[9px] px-1.5 py-px rounded-full border" style={{ background: '#2E1A4A', color: '#C498F8', borderColor: '#42286B' }}>Client</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center w-full py-1.5 transition-colors duration-150"
            style={{ color: '#3D3D3B' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#A8A39A' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#3D3D3B' }}
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between h-12 px-4 border-b" style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-surface-2)' }}>
        <button onClick={() => setMobileOpen(true)} style={{ color: 'var(--color-text-primary)' }}>
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-[15px] font-medium" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans)' }}>
          <span style={{ color: 'var(--accent)' }}>◆</span> Acquire
        </span>
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0" style={{ background: 'var(--color-accent-muted)', color: 'var(--color-accent-light)' }}>C</div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }} onClick={() => setMobileOpen(false)} />
          <aside className="fixed left-0 top-0 bottom-0 w-[280px] flex flex-col" style={{ background: '#0E0E0E', borderRight: '1px solid #1A1A1A' }}>
            <div className="flex items-center justify-between h-[52px] px-4 border-b" style={{ borderColor: '#1A1A1A', borderBottom: '1px solid rgba(200, 150, 60, 0.15)' }}>
              <div className="flex items-center gap-2">
                <span className="text-lg" style={{ color: 'var(--accent)' }}>◆</span>
                <span className="text-[15px] font-medium" style={{ color: '#F0EDE8', fontFamily: 'var(--font-dm-sans)' }}>Acquire</span>
              </div>
              <button onClick={() => setMobileOpen(false)} style={{ color: '#A8A39A' }}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 py-3 px-2 space-y-0.5">
              <div className="text-[9px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 select-none" style={{ color: '#3D3D3B' }}>Client</div>
              {navItems.map((item) => {
                const isActive = pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 h-[34px] px-3 mx-0.5 rounded-md text-[13px] no-underline transition-colors duration-150"
                    style={{ color: isActive ? '#F7F5F0' : '#A8A39A', background: isActive ? '#242424' : 'transparent', fontWeight: isActive ? 500 : 400 }}
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
            <div className="p-2 border-t" style={{ borderColor: '#1A1A1A' }}>
              <button onClick={handleLogout} className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-[13px] transition-colors" style={{ color: '#F08080' }}>
                <LogOut className="h-5 w-5" /> Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main content */}
      <main
        className="flex-1 overflow-auto transition-all duration-250"
        style={{
          background: 'var(--color-canvas)',
          marginLeft: collapsed ? '52px' : '220px',
          transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div className="pt-8 px-8 pb-8 max-lg:px-6 max-md:px-4 max-md:pt-14">
          {children}
        </div>
      </main>
    </div>
  )
}
