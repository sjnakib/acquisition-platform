'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, Phone, ChevronLeft, PanelRightClose, LogOut, User } from 'lucide-react'

const navItems = [
  { label: 'Active Deals', icon: LayoutDashboard, href: '/overview' },
  { label: 'Call Queue', icon: Phone, href: '/calls' },
]

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <div className="min-h-screen flex">
      <aside
        className={`hidden lg:flex flex-col bg-slate-900 border-r border-slate-700 transition-all duration-200 ${
          collapsed ? 'w-[60px]' : 'w-[240px]'
        }`}
      >
        <div className="flex items-center h-14 px-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-purple-600 rounded flex items-center justify-center text-white text-xs font-bold">AP</div>
            {!collapsed && <span className="text-white text-sm font-semibold">Client Portal</span>}
          </div>
        </div>

        <nav className="flex-1 py-4 space-y-1 px-2">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-slate-700 text-white border-l-2 border-purple-500'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && item.label}
              </Link>
            )
          })}
        </nav>

        <div className="p-2 border-t border-slate-700">
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            >
              <div className="w-7 h-7 bg-slate-600 rounded-full flex items-center justify-center text-xs text-white">C</div>
              {!collapsed && (
                <div className="flex-1 text-left text-xs">
                  <div className="text-slate-200 font-medium truncate">Client</div>
                  <div className="text-purple-400">Client</div>
                </div>
              )}
            </button>
            {userMenuOpen && (
              <div className="absolute bottom-full left-2 mb-1 w-48 bg-white rounded-md shadow-lg border border-slate-200 py-1 z-50">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center w-full mt-1 py-1 text-slate-500 hover:text-slate-300"
          >
            <ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </aside>

      <div className="lg:hidden flex items-center h-14 px-4 bg-white border-b border-slate-200 w-full">
        <button onClick={() => setMobileOpen(true)} className="text-slate-600">
          <PanelRightClose className="h-5 w-5" />
        </button>
        <span className="ml-3 text-sm font-semibold text-slate-900">Client Portal</span>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="fixed left-0 top-0 bottom-0 w-64 bg-slate-900 border-r border-slate-700 flex flex-col">
            <div className="flex items-center h-14 px-4 border-b border-slate-700">
              <span className="text-white text-sm font-semibold">Client Portal</span>
            </div>
            <nav className="flex-1 py-4 space-y-1 px-2">
              {navItems.map((item) => {
                const isActive = pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm ${
                      isActive ? 'bg-slate-700 text-white' : 'text-slate-400'
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
            <div className="p-2 border-t border-slate-700">
              <button onClick={handleLogout} className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-red-400">
                <LogOut className="h-5 w-5" /> Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      <main className="flex-1 bg-slate-50 overflow-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </div>
      </main>
    </div>
  )
}
