'use client'

import { useState, useEffect, useRef, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft, ChevronRight, Menu, LogOut, User, X, Sun, Moon,
} from 'lucide-react'
import type { NavItem } from '@/lib/navigation'
import { BrandLogo } from '@/components/shared/BrandLogo'
import { Tooltip } from '@/components/ui/tooltip'

function getStoredTheme(): 'light' | 'dark' {
  try {
    return localStorage.getItem('acq_theme') === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

function setStoredTheme(theme: 'light' | 'dark') {
  try {
    localStorage.setItem('acq_theme', theme)
    document.documentElement.classList.toggle('dark', theme === 'dark')
  } catch { /* noop */ }
}

interface NavSection {
  label: string
  items: NavItem[]
}

interface SidebarProfile {
  avatar: string
  avatarUrl?: string | null
  name: string
  subtitle: ReactNode
}

interface SidebarProps {
  navSections: NavSection[]
  profile: SidebarProfile
  collapsed: boolean
  onToggleCollapse: () => void
  onLogout: () => void
}

const s = (v: string) => `var(--color-sidebar-${v})`

export default function Sidebar({ navSections, profile, collapsed, onToggleCollapse, onLogout }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [theme, setThemeState] = useState<'light' | 'dark'>('light')
  const [mounted, setMounted] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const projectId = pathname.split('/')[2] || ''
  const router = useRouter()

  const [width, setWidth] = useState(220)
  const isDraggingRef = useRef(false)

  // Load custom sidebar width on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('acq_sidebar_width')
      if (stored) {
        const val = parseInt(stored, 10)
        if (val >= 160 && val <= 400) {
          setTimeout(() => setWidth(val), 0)
        }
      }
    } catch {}
  }, [])

  // Sync state to CSS variable --sidebar-width on the document element
  useEffect(() => {
    const w = collapsed ? '52px' : `${width}px`
    document.documentElement.style.setProperty('--sidebar-width', w)
  }, [collapsed, width])

  function handleMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    isDraggingRef.current = true
    document.documentElement.classList.add('sidebar-dragging')
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return
      const nextWidth = Math.max(160, Math.min(400, moveEvent.clientX))
      setWidth(nextWidth)
      try {
        localStorage.setItem('acq_sidebar_width', String(nextWidth))
      } catch {}
    }

    const handleMouseUp = () => {
      isDraggingRef.current = false
      document.documentElement.classList.remove('sidebar-dragging')
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  // Required: defer localStorage read to client to avoid hydration mismatch
  /* eslint-disable */
  useEffect(() => {
    setThemeState(getStoredTheme())
    setMounted(true)
  }, [])
  /* eslint-enable */

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setThemeState(next)
    setStoredTheme(next)
  }

  useEffect(() => {
    if (!userMenuOpen) return
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [userMenuOpen])

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex flex-col fixed left-0 top-0 h-full border-r transition-all duration-250 z-40"
        style={{
          width: 'var(--sidebar-width)',
          background: s('bg'),
          borderColor: s('border'),
          transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Drag handle */}
        {!collapsed && (
          <div
            onMouseDown={handleMouseDown}
            className="absolute top-0 right-0 w-[4px] h-full cursor-col-resize hover:bg-[var(--accent)] active:bg-[var(--accent)] transition-colors z-50 select-none"
            style={{ transform: 'translateX(2px)' }}
          />
        )}
        {/* Wordmark */}
        <div className="flex items-center h-[52px] px-4 border-b" style={{ borderColor: s('border') }}>
          {collapsed
            ? <BrandLogo variant="icon" />
            : <div style={{ color: s('text-active') }}><BrandLogo variant="wordmark" /></div>
          }
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5">
          {navSections.map((section, i) => (
            <div key={section.label === 'Global' ? 'Global' : `${section.label}-${projectId || 'global'}`}>
              {i > 0 && collapsed && (
                <div className="my-2 mx-1.5 border-t" style={{ borderColor: s('border') }} />
              )}
              {i > 0 && !collapsed && (
                <div 
                  className="text-[9px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 mt-3 select-none truncate animate-item-entrance" 
                  style={{ color: s('text-muted'), animationDelay: `${i * 120}ms` }}
                >
                  {section.label}
                </div>
              )}
              {i === 0 && !collapsed && (
                <div className="text-[9px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 select-none truncate" style={{ color: s('text-muted') }}>
                  {section.label}
                </div>
              )}
              {section.items.map((item, idx) => {
                const isActive = item.href === '/projects' ? pathname === '/projects' : pathname.startsWith(item.href)
                const delay = (i * 120) + ((idx + 1) * 30)
                
                return (
                  <div
                    key={item.href}
                    className={section.label === 'Global' ? '' : 'animate-item-entrance'}
                    style={section.label === 'Global' ? undefined : { animationDelay: `${delay}ms` }}
                  >
                    <Tooltip content={collapsed ? item.label : null} position="right" className="w-full">
                      <Link
                        href={item.href}
                        className={`group flex items-center gap-3 h-[34px] mx-0.5 rounded-md text-[13px] font-normal transition-all duration-150 no-underline whitespace-nowrap overflow-hidden ${collapsed ? 'justify-center' : 'px-3'}`}
                        style={{
                          color: isActive ? s('text-active') : s('text'),
                          background: isActive ? s('active') : 'transparent',
                          fontWeight: isActive ? 500 : 400,
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.background = s('hover')
                            e.currentTarget.style.color = s('text-hover')
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.background = 'transparent'
                            e.currentTarget.style.color = s('text')
                          }
                        }}
                      >
                        <item.icon 
                          className={`h-4 w-4 flex-shrink-0 transition-all duration-300 ${isActive ? '' : 'group-hover:scale-108 group-hover:translate-x-0.5 group-hover:text-[var(--accent)]'}`} 
                          style={{ opacity: isActive ? 1 : 0.7 }} 
                        />
                        {!collapsed && (
                          <span className="truncate flex-1 transition-transform duration-300 group-hover:translate-x-0.5">
                            {item.label}
                          </span>
                        )}
                      </Link>
                    </Tooltip>
                  </div>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Theme toggle */}
        <div className="px-2 pb-1">
          <Tooltip content={collapsed && mounted ? (theme === 'dark' ? 'Light mode' : 'Dark mode') : null} position="right" className="w-full">
            <button
              onClick={toggleTheme}
              className={`group flex items-center gap-3 h-[34px] w-full mx-0.5 rounded-md text-[13px] transition-all duration-150 ${collapsed ? 'justify-center' : 'px-3'}`}
              style={{ color: s('text') }}
              onMouseEnter={(e) => { e.currentTarget.style.background = s('hover') }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              {mounted && (
                theme === 'dark' ? (
                  <Sun className="h-4 w-4 flex-shrink-0 transition-transform duration-500 ease-out group-hover:rotate-90 group-hover:text-[var(--accent)]" />
                ) : (
                  <Moon className="h-4 w-4 flex-shrink-0 transition-transform duration-500 ease-out group-hover:-rotate-12 group-hover:text-[var(--accent)]" />
                )
              )}
              {!collapsed && mounted && (theme === 'dark' ? 'Light mode' : 'Dark mode')}
            </button>
          </Tooltip>
        </div>

        {/* User profile */}
        <div className="border-t" style={{ borderColor: s('border') }}>
          <div className="relative p-2" ref={menuRef}>
            <Tooltip content={collapsed ? `Profile (${profile.name})` : null} position="right" className="w-full">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className={`flex items-center gap-3 w-full py-2 rounded-md transition-colors duration-150 ${collapsed ? 'justify-center' : 'px-3'}`}
                style={{
                  color: pathname === '/profile' ? s('text-active') : s('text'),
                  background: pathname === '/profile' ? s('active') : 'transparent',
                  fontWeight: pathname === '/profile' ? 500 : 400
                }}
                onMouseEnter={(e) => {
                  if (pathname !== '/profile') {
                    e.currentTarget.style.background = s('hover')
                    e.currentTarget.style.color = s('text-hover')
                  }
                }}
                onMouseLeave={(e) => {
                  if (pathname !== '/profile') {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = s('text')
                  }
                }}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0"
                  style={
                    profile.avatarUrl
                      ? profile.avatarUrl.startsWith('linear-gradient')
                        ? { background: profile.avatarUrl, color: 'var(--color-text-inverse)' }
                        : { backgroundImage: `url(${profile.avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', color: 'transparent' }
                      : { background: 'var(--color-accent-muted)', color: 'var(--color-accent-light)' }
                  }
                >
                  {!profile.avatarUrl || profile.avatarUrl.startsWith('linear-gradient') ? profile.avatar : ''}
                </div>
                {!collapsed && (
                  <div className="flex-1 text-left leading-tight overflow-hidden">
                    <div 
                      className="text-[13px] font-medium truncate" 
                      style={{ color: pathname === '/profile' ? s('text-active') : 'var(--color-text-primary)' }}
                    >
                      {profile.name}
                    </div>
                    <div 
                      className="flex items-center gap-1 truncate text-[11px] font-medium tracking-[0.03em] uppercase"
                      style={{ color: pathname === '/profile' ? s('text-active') : s('text-muted') }}
                    >
                      {profile.subtitle}
                    </div>
                  </div>
                )}
              </button>
            </Tooltip>

            {userMenuOpen && (
              <div
                className="absolute bottom-full left-2 mb-1 w-40 rounded-lg shadow-lg py-1 z-50 animate-dropdown-show"
                style={{ background: 'var(--color-surface-0)', border: '1px solid var(--color-surface-3)', boxShadow: 'var(--shadow-lg)' }}
              >
                <button
                  onClick={() => { setUserMenuOpen(false); router.push('/profile') }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-[13px] transition-colors"
                  style={{ color: 'var(--color-text-primary)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-1)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                >
                  <User className="h-4 w-4" /> View profile
                </button>
                <div className="my-1" style={{ borderTop: '1px solid var(--color-surface-3)' }} />
                <button
                  onClick={onLogout}
                  className="flex items-center gap-2 w-full px-3 py-2 text-[13px] rounded transition-colors duration-150"
                  style={{ color: 'var(--color-danger-text)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-danger-bg)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            )}
          </div>

          {/* Collapse toggle */}
          <button
            onClick={onToggleCollapse}
            className="group flex items-center justify-center w-full py-1.5 transition-colors duration-150"
            style={{ color: s('text-muted') }}
            onMouseEnter={(e) => { e.currentTarget.style.color = s('text') }}
            onMouseLeave={(e) => { e.currentTarget.style.color = s('text-muted') }}
          >
            {collapsed ? (
              <ChevronRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-[var(--accent)]" />
            ) : (
              <ChevronLeft className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-x-0.5 group-hover:text-[var(--accent)]" />
            )}
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between h-12 px-4 border-b" style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-surface-2)' }}>
        <button onClick={() => setMobileOpen(true)} style={{ color: 'var(--color-text-primary)' }}>
          <Menu className="h-5 w-5" />
        </button>
        <div style={{ color: 'var(--color-text-primary)' }}>
          <BrandLogo variant="wordmark" />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {mounted && (theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />)}
          </button>
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0"
            style={
              profile.avatarUrl
                ? profile.avatarUrl.startsWith('linear-gradient')
                  ? { background: profile.avatarUrl, color: 'var(--color-text-inverse)' }
                  : { backgroundImage: `url(${profile.avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', color: 'transparent' }
                : { background: 'var(--color-accent-muted)', color: 'var(--color-accent-light)' }
            }
          >
            {!profile.avatarUrl || profile.avatarUrl.startsWith('linear-gradient') ? profile.avatar : ''}
          </div>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 animate-overlay-show" style={{ background: 'var(--color-overlay)', backdropFilter: 'blur(2px)' }} onClick={() => setMobileOpen(false)} />
          <aside className="fixed left-0 top-0 bottom-0 w-[280px] flex flex-col animate-sheet-slide-in-left" style={{ background: s('bg'), borderRight: `1px solid ${s('border')}` }}>
            <div className="flex items-center justify-between h-[52px] px-4 border-b" style={{ borderColor: s('border') }}>
              <div style={{ color: s('text-active') }} onClick={() => setMobileOpen(false)}>
                <BrandLogo variant="wordmark" />
              </div>
              <button onClick={() => setMobileOpen(false)} style={{ color: s('text') }}>
                <X className="h-5 w-5" />
              </button>
            </div>
             <nav className="flex-1 py-3 px-2 space-y-0.5">
              {navSections.map((section, i) => (
                <div key={section.label === 'Global' ? 'Global' : `${section.label}-${projectId || 'global'}`}>
                  <div 
                    className={`text-[9px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 select-none ${i > 0 ? 'mt-3 animate-item-entrance' : ''}`} 
                    style={{ color: s('text-muted'), animationDelay: i > 0 ? `${i * 120}ms` : undefined }}
                  >
                    {section.label}
                  </div>
                  {section.items.map((item, idx) => {
                    const isActive = item.href === '/projects' ? pathname === '/projects' : pathname.startsWith(item.href)
                    const delay = (i * 120) + ((idx + 1) * 30)
                    
                    return (
                      <div
                        key={item.href}
                        className={section.label === 'Global' ? '' : 'animate-item-entrance'}
                        style={section.label === 'Global' ? undefined : { animationDelay: `${delay}ms` }}
                      >
                        <Link
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                          className="flex items-center gap-3 h-[34px] px-3 mx-0.5 rounded-md text-[13px] no-underline transition-colors duration-150"
                          style={{ color: isActive ? s('text-active') : s('text'), background: isActive ? s('active') : 'transparent', fontWeight: isActive ? 500 : 400 }}
                        >
                          <item.icon className="h-4 w-4 flex-shrink-0" />
                          {item.label}
                        </Link>
                      </div>
                    )
                  })}
                </div>
              ))}
            </nav>
            <div className="px-2 pb-1">
              <button
                onClick={() => { toggleTheme(); setMobileOpen(false) }}
                className="flex items-center gap-3 h-[34px] w-full px-3 mx-0.5 rounded-md text-[13px] transition-colors duration-150"
                style={{ color: s('text') }}
              >
                {mounted && (theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />)}
                {mounted && (theme === 'dark' ? 'Light mode' : 'Dark mode')}
              </button>
            </div>
            <div className="p-2 border-t" style={{ borderColor: s('border') }}>
              <button onClick={onLogout} className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-[13px] transition-colors" style={{ color: 'var(--color-danger-text)' }}>
                <LogOut className="h-5 w-5" /> Sign out
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
