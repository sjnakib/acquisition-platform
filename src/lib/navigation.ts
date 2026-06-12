import { LayoutDashboard, Phone, FolderKanban, Building2, Megaphone, Upload, Settings, Handshake, Shield, type LucideIcon } from 'lucide-react'

export interface NavItem {
  label: string
  icon: LucideIcon
  href: string
}

export function internalNavItems(projectId: string): NavItem[] {
  return [
    { label: 'Dashboard',  icon: LayoutDashboard, href: `/projects/${projectId}/dashboard` },
    { label: 'Deals',      icon: Building2,       href: `/projects/${projectId}/deals` },
    { label: 'Portfolios', icon: FolderKanban,    href: `/projects/${projectId}/portfolios` },
    { label: 'Campaigns',  icon: Megaphone,       href: `/projects/${projectId}/campaigns` },
    { label: 'Import',     icon: Upload,          href: `/projects/${projectId}/import` },
    { label: 'Settings',   icon: Settings,        href: `/projects/${projectId}/settings` },
  ]
}

export function clientNavItems(projectId: string): NavItem[] {
  return [
    { label: 'Active Deals', icon: Handshake,       href: `/projects/${projectId}/overview` },
    { label: 'Call Queue',   icon: Phone,           href: `/projects/${projectId}/calls` },
  ]
}

export function adminNavItems(): NavItem[] {
  return [
    { label: 'Admin Panel', icon: Shield, href: '/admin' },
  ]
}
