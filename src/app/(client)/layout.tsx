'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { LayoutDashboard, Phone, ChevronLeft, ChevronRight, Menu, LogOut, X, Sun, Moon } from 'lucide-react'

const navItems = [
  { label: 'Active Deals', icon: LayoutDashboard, href: '/overview' },
  { label: 'Call Queue', icon: Phone, href: '/calls' },
]

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()

  useEffect(() => { setMounted(true) }, [])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const s = (v: string) => `var(--color-sidebar-${v})`

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex flex-col fixed left-0 top-0 h-full border-r transition-all duration-250 ${collapsed ? 'w-[52px]' : 'w-[220px]'}`}
        style={{
          background: s('bg'),
          borderColor: s('border'),
          transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div className="flex items-center h-[52px] px-4 border-b" style={{ borderColor: s('border'), borderBottomColor: 'rgba(200, 150, 60, 0.15)' }}>
          <div className="flex items-center gap-2">
            <span className="text-lg" style={{ color: 'var(--accent)' }}>◆</span>
            {!collapsed && <span className="text-[15px] font-medium" style={{ color: s('text-active'), fontFamily: 'var(--font-dm-sans)' }}>Acquire</span>}
          </div>
        </div>

        <nav className="flex-1 py-3 px-2 space-y-0.5">
          <div className="text-[9px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 select-none" style={{ color: s('text-muted') }}>
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
                  color: isActive ? s('text-active') : s('text'),
                  background: isActive ? s('active') : 'transparent',
                  fontWeight: isActive ? 500 : 400,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) { e.currentTarget.style.background = s('hover'); e.currentTarget.style.color = s('text-active') }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = s('text') }
                }}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" style={{ opacity: isActive ? 1 : 0.7 }} />
                {!collapsed && item.label}
              </Link>
            )
          })}
        </nav>

        {/* Theme toggle */}
        <div className="px-2 pb-1">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex items-center gap-3 h-[34px] w-full px-3 mx-0.5 rounded-md text-[13px] transition-all duration-150"
            style={{ color: s('text') }}
            onMouseEnter={(e) => { e.currentTarget.style.background = s('hover') }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            {mounted && (theme === 'dark' ? <Sun className="h-4 w-4 flex-shrink-0" /> : <Moon className="h-4 w-4 flex-shrink-0" />)}
            {!collapsed && (mounted ? (theme === 'dark' ? 'Light mode' : 'Dark mode') : 'Theme')}
          </button>
        </div>

        <div className="border-t" style={{ borderColor: s('border') }}>
          <div className="p-2">
            <div className="flex items-center gap-3 px-3 py-2 rounded-md">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0" style={{ background: 'var(--color-accent-muted)', color: 'var(--color-accent-light)' }}>C</div>
              {!collapsed && (
                <div className="flex-1 text-left leading-tight">
                  <div className="text-[13px] font-medium" style={{ color: s('text-active') }}>Client</div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px]" style={{ color: s('text-muted') }}>Client</span>
                    <span className="text-[9px] px-1.5 py-px rounded-full border" style={{ background: '#2E1A4A', color: '#C498F8', borderColor: '#42286B' }}>Client</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center w-full py-1.5 transition-colors duration-150"
            style={{ color: s('text-muted') }}
            onMouseEnter={(e) => { e.currentTarget.style.color = s('text') }}
            onMouseLeave={(e) => { e.currentTarget.style.color = s('text-muted') }}
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
        <div className="flex items-center gap-2">
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} style={{ color: 'var(--color-text-secondary)' }}>
            {mounted && (theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />)}
          </button>
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0" style={{ background: 'var(--color-accent-muted)', color: 'var(--color-accent-light)' }}>C</div>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }} onClick={() => setMobileOpen(false)} />
          <aside className="fixed left-0 top-0 bottom-0 w-[280px] flex flex-col" style={{ background: s('bg'), borderRight: `1px solid ${s('border')}` }}>
            <div className="flex items-center justify-between h-[52px] px-4 border-b" style={{ borderColor: s('border'), borderBottomColor: 'rgba(200, 150, 60, 0.15)' }}>
              <div className="flex items-center gap-2">
                <span className="text-lg" style={{ color: 'var(--accent)' }}>◆</span>
                <span className="text-[15px] font-medium" style={{ color: s('text-active'), fontFamily: 'var(--font-dm-sans)' }}>Acquire</span>
              </div>
              <button onClick={() => setMobileOpen(false)} style={{ color: s('text') }}><X className="h-5 w-5" /></button>
            </div>
            <nav className="flex-1 py-3 px-2 space-y-0.5">
              <div className="text-[9px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 select-none" style={{ color: s('text-muted') }}>Client</div>
              {navItems.map((item) => {
                const isActive = pathname.startsWith(item.href)
                return (
                  <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 h-[34px] px-3 mx-0.5 rounded-md text-[13px] no-underline transition-colors duration-150"
                    style={{ color: isActive ? s('text-active') : s('text'), background: isActive ? s('active') : 'transparent', fontWeight: isActive ? 500 : 400 }}
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />{item.label}
                  </Link>
                )
              })}
            </nav>
            <div className="px-2 pb-1">
              <button onClick={() => { setTheme(theme === 'dark' ? 'light' : 'dark'); setMobileOpen(false) }}
                className="flex items-center gap-3 h-[34px] w-full px-3 mx-0.5 rounded-md text-[13px] transition-colors duration-150"
                style={{ color: s('text') }}
              >
                {mounted && (theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />)}
                {mounted ? (theme === 'dark' ? 'Light mode' : 'Dark mode') : 'Theme'}
              </button>
            </div>
            <div className="p-2 border-t" style={{ borderColor: s('border') }}>
              <button onClick={handleLogout} className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-[13px] transition-colors" style={{ color: 'var(--color-danger-text)' }}>
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
