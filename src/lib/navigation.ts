import { LayoutDashboard, Phone, type LucideIcon } from 'lucide-react'

export interface NavItem {
  label: string
  icon: LucideIcon
  href: string
}

export const clientNavItems: NavItem[] = [
  { label: 'Active Deals', icon: LayoutDashboard, href: '/overview' },
  { label: 'Call Queue', icon: Phone, href: '/calls' },
]
