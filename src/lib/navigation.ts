import { LayoutDashboard, Phone, FolderKanban, type LucideIcon } from 'lucide-react'

export interface NavItem {
  label: string
  icon: LucideIcon
  href: string
}

export const internalNavItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { label: 'Deals', icon: LayoutDashboard, href: '/deals' },
  { label: 'Portfolios', icon: FolderKanban, href: '/portfolios' },
  { label: 'Campaigns', icon: LayoutDashboard, href: '/campaigns' },
  { label: 'Import', icon: LayoutDashboard, href: '/import' },
  { label: 'Settings', icon: LayoutDashboard, href: '/settings' },
]

export const clientNavItems: NavItem[] = [
  { label: 'Active Deals', icon: LayoutDashboard, href: '/overview' },
  { label: 'Call Queue', icon: Phone, href: '/calls' },
]
