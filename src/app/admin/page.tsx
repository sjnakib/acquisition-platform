'use client'

import { useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Shield, Plus, Trash2, Users, FolderKanban, Search, ShieldCheck, UserCheck, MailQuestion, Eye, Building2, Mail, Clock, XCircle, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { PageHeader } from '@/components/shared/PageHeader'
import { CreateUserDialog } from '@/components/admin/CreateUserDialog'
import { DeleteUserDialog } from '@/components/admin/DeleteUserDialog'
import { DeleteInvitationDialog } from '@/components/admin/DeleteInvitationDialog'
import { UserDetailDrawer } from '@/components/admin/UserDetailDrawer'
import { ProjectDetailDrawer } from '@/components/admin/ProjectDetailDrawer'
import { DisconnectEmailDialog } from '@/components/admin/DisconnectEmailDialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface UserProject {
  id: string
  name: string
  sponsorId?: string
  memberId?: string
}

interface UserRow {
  id: string
  email: string | null
  full_name: string | null
  role: 'internal' | 'client' | 'admin'
  client_org: string | null
  created_at: string
  last_sign_in_at?: string | null
  invited_at?: string | null
  projects: UserProject[]
}

interface Project {
  id: string
  name: string
  description: string | null
  created_at: string
  dealCount: number
  campaignCount: number
  sponsors: { count: number }[] | null
}

const ROLE_LABELS = {
  admin: 'Admin',
  internal: 'Team Member',
  client: 'Sponsor',
}

function AdminDashboardContent() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  
  // Tabs & Filters from Query String
  const activeTab = (searchParams.get('tab') as 'users' | 'projects' | 'invitations') ?? 'users'
  const setActiveTab = useCallback((tab: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [searchParams, router, pathname])

  const [userSearch, setUserSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [projectSearch, setProjectSearch] = useState('')

  // Dialog & Drawer States
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null)
  const [deleteInvitationTarget, setDeleteInvitationTarget] = useState<{ id: string; email: string } | null>(null)
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false)

  // Invitation type
  interface InvitationRow {
    id: string
    email: string
    role: string
    token: string
    status: string
    project_ids: string[]
    expires_at: string
    accepted_at: string | null
    invited_by_name: string
    created_at: string
  }

  // Fetch Current User (self)
  const { data: currentUserId } = useQuery<string | null>({
    queryKey: ['auth', 'userId'],
    queryFn: async () => {
      const res = await fetch('/api/auth/me')
      if (!res.ok) return null
      const json = await res.json()
      return json?.user?.id ?? null
    },
    staleTime: Infinity,
  })

  // Fetch Users
  const { data: users = [], isLoading: loadingUsers, error: usersError } = useQuery<UserRow[]>({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const res = await fetch('/api/admin/users')
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
  })

  // Fetch Invitations
  const { data: invitations = [], isLoading: loadingInvitations } = useQuery<InvitationRow[]>({
    queryKey: ['admin', 'invitations'],
    queryFn: async () => {
      const res = await fetch('/api/admin/invitations')
      if (!res.ok) return []
      return res.json()
    },
  })

  // Fetch Projects
  const { data: projects = [], isLoading: loadingProjects } = useQuery<Project[]>({
    queryKey: ['projects', 'all'],
    queryFn: async () => {
      const res = await fetch('/api/projects')
      if (!res.ok) return []
      const data = await res.json()
      // Map to include detailed project counts
      const enriched = await Promise.all(
        (data ?? []).map(async (p: any) => {
          const detailRes = await fetch(`/api/projects/${p.id}`)
          if (!detailRes.ok) return p
          return detailRes.json()
        })
      )
      return enriched
    },
  })

  function handleDataUpdated() {
    queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'invitations'] })
    queryClient.invalidateQueries({ queryKey: ['projects'] })
    // If a drawer is open, keep its state synced by re-fetching target from fresh list
    if (selectedUser) {
      const freshUser = users.find((u) => u.id === selectedUser.id)
      if (freshUser) setSelectedUser(freshUser)
    }
  }

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const matchesSearch = 
      (u.full_name ?? '').toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.email ?? '').toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.client_org ?? '').toLowerCase().includes(userSearch.toLowerCase())
    
    const matchesRole = roleFilter === 'all' || u.role === roleFilter

    const isPending = !u.last_sign_in_at && !!u.invited_at
    const matchesStatus = 
      statusFilter === 'all' ||
      (statusFilter === 'active' && !isPending) ||
      (statusFilter === 'pending' && isPending)

    return matchesSearch && matchesRole && matchesStatus
  })

  // Filtered Projects
  const filteredProjects = projects.filter((p) => {
    return (p.name ?? '').toLowerCase().includes(projectSearch.toLowerCase()) ||
      (p.description ?? '').toLowerCase().includes(projectSearch.toLowerCase())
  })

  // System Email Connection
  const { data: systemEmail = { connected: false, google_email: null } } = useQuery<{
    connected: boolean
    google_email: string | null
  }>({
    queryKey: ['admin', 'system-email'],
    queryFn: async () => {
      const res = await fetch('/api/admin/system-email')
      if (!res.ok) return { connected: false, google_email: null }
      return res.json()
    },
  })

  async function disconnectSystemEmail() {
    const res = await fetch('/api/admin/system-email', { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error ?? 'Failed to disconnect')
    }
    toast.success('System email disconnected')
    queryClient.invalidateQueries({ queryKey: ['admin', 'system-email'] })
  }

  // Stats Calculations
  const stats = {
    totalUsers: users.length,
    admins: users.filter((u) => u.role === 'admin').length,
    internal: users.filter((u) => u.role === 'internal').length,
    client: users.filter((u) => u.role === 'client').length,
    totalProjects: projects.length,
    pendingInvites: invitations.filter((i) => i.status === 'pending').length,
  }

  return (
    <>
      <PageHeader
        title="Admin Dashboard"
        description="Global system administration, project memberships, and account lifecycle."
        actions={
          <Button onClick={() => setCreateOpen(true)} style={{ background: 'var(--accent)', color: 'var(--color-text-inverse)' }} className="shadow-xs text-xs h-9">
            <Plus className="h-4 w-4 mr-1.5" />
            Invite Member
          </Button>
        }
      />

      {/* System Email */}
      <div className="mt-6 animate-item-entrance" style={{ animationDelay: '0ms' }}>
        <div
          className="p-5 rounded-xl border flex items-center justify-between"
          style={{
            background: 'var(--color-surface-0)',
            borderColor: systemEmail.connected ? 'var(--color-accent-light)' : 'var(--color-surface-2)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                background: systemEmail.connected ? 'var(--color-accent-bg)' : 'var(--color-surface-1)',
                color: systemEmail.connected ? 'var(--accent)' : 'var(--color-text-tertiary)',
                border: `1px solid ${systemEmail.connected ? 'var(--color-accent-light)' : 'var(--color-surface-2)'}`,
              }}
            >
              <Mail size={16} />
            </div>
            <div>
              <h3 className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                System Email
              </h3>
              <p className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
                {systemEmail.connected
                  ? `Connected as ${systemEmail.google_email}`
                  : 'Not connected — invitation emails will fail'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {systemEmail.connected ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDisconnectDialogOpen(true)}
                className="h-8 text-[11px] border-[var(--color-surface-3)]"
              >
                Disconnect
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-8 text-[11px]"
                style={{ background: 'var(--accent)', color: 'var(--color-text-inverse)' }}
                asChild
              >
                <a href="/api/auth/google?type=system">Connect Gmail</a>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-6">
        <div className="p-4 rounded-xl border flex flex-col justify-between bg-[var(--color-surface-0)] shadow-xs animate-item-entrance" style={{ borderColor: 'var(--color-surface-2)', animationDelay: '0ms' }}>
          <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-text-secondary)]">Total Accounts</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-xl font-semibold text-[var(--color-text-primary)] font-mono">{stats.totalUsers}</span>
            <Users size={14} className="text-[var(--color-text-tertiary)]" />
          </div>
        </div>

        <div className="p-4 rounded-xl border flex flex-col justify-between bg-[var(--color-surface-0)] shadow-xs animate-item-entrance" style={{ borderColor: 'var(--color-surface-2)', animationDelay: '40ms' }}>
          <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-text-secondary)]">Administrators</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-xl font-semibold text-[var(--color-text-primary)] font-mono">{stats.admins}</span>
            <Shield size={14} className="text-[var(--color-text-tertiary)]" />
          </div>
        </div>

        <div className="p-4 rounded-xl border flex flex-col justify-between bg-[var(--color-surface-0)] shadow-xs animate-item-entrance" style={{ borderColor: 'var(--color-surface-2)', animationDelay: '80ms' }}>
          <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-text-secondary)]">Team Members</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-xl font-semibold text-[var(--color-text-primary)] font-mono">{stats.internal}</span>
            <UserCheck size={14} className="text-[var(--color-text-tertiary)]" />
          </div>
        </div>

        <div className="p-4 rounded-xl border flex flex-col justify-between bg-[var(--color-surface-0)] shadow-xs animate-item-entrance" style={{ borderColor: 'var(--color-surface-2)', animationDelay: '120ms' }}>
          <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-text-secondary)]">Sponsors</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-xl font-semibold text-[var(--color-text-primary)] font-mono">{stats.client}</span>
            <Building2 size={14} className="text-[var(--color-text-tertiary)]" />
          </div>
        </div>

        <div className="p-4 rounded-xl border flex flex-col justify-between bg-[var(--color-surface-0)] shadow-xs animate-item-entrance col-span-2 md:col-span-1" style={{ borderColor: 'var(--color-surface-2)', animationDelay: '160ms' }}>
          <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-text-secondary)]">Active Projects</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-xl font-semibold text-[var(--color-text-primary)] font-mono">{stats.totalProjects}</span>
            <FolderKanban size={14} className="text-[var(--color-text-tertiary)]" />
          </div>
        </div>
      </div>

      <Tabs defaultValue="users" value={activeTab} onValueChange={(val: any) => setActiveTab(val)}>
        <TabsList className="mt-8">
          <TabsTrigger value="users">Users & Security</TabsTrigger>
          <TabsTrigger value="projects">Projects Directory</TabsTrigger>
          <TabsTrigger value="invitations">
            Invitations
            {invitations.filter((i) => i.status === 'pending').length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px]" style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning-text)' }}>
                {invitations.filter((i) => i.status === 'pending').length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Main View Area */}
        <div className="mt-5">
          <TabsContent value="users" keepMounted>
            <div className="space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--color-text-tertiary)]" />
                <Input
                  placeholder="Search users by name, email, or company..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="pl-9 h-9.5 text-xs bg-[var(--color-surface-0)] border-[var(--color-surface-2)] focus:ring-[var(--accent)]"
                />
              </div>

              <div className="flex items-center gap-2">
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="h-9.5 text-xs min-w-[130px] bg-[var(--color-surface-0)] border-[var(--color-surface-2)]">
                    <SelectValue placeholder="All Roles" />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--color-surface-0)] border-[var(--color-surface-2)]">
                    <SelectItem className="text-xs focus:bg-[var(--color-accent-bg)]" value="all">All Roles</SelectItem>
                    <SelectItem className="text-xs focus:bg-[var(--color-accent-bg)]" value="admin">Admin</SelectItem>
                    <SelectItem className="text-xs focus:bg-[var(--color-accent-bg)]" value="internal">Team Member</SelectItem>
                    <SelectItem className="text-xs focus:bg-[var(--color-accent-bg)]" value="client">Sponsor</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9.5 text-xs min-w-[140px] bg-[var(--color-surface-0)] border-[var(--color-surface-2)]">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--color-surface-0)] border-[var(--color-surface-2)]">
                    <SelectItem className="text-xs focus:bg-[var(--color-accent-bg)]" value="all">All Statuses</SelectItem>
                    <SelectItem className="text-xs focus:bg-[var(--color-accent-bg)]" value="active">Active Accounts</SelectItem>
                    <SelectItem className="text-xs focus:bg-[var(--color-accent-bg)]" value="pending">Pending setup</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Table */}
            {loadingUsers ? (
              <div className="flex items-center justify-center py-20">
                <LoadingSpinner size="lg" />
              </div>
            ) : usersError ? (
              <div className="rounded-xl p-6 text-center border text-xs" style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger-text)', borderColor: 'var(--color-danger-border)' }}>
                Failed to load users. Ensure you have administrator access.
              </div>
            ) : (
              <div className="rounded-xl border overflow-hidden shadow-2xs" style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-surface-2)' }}>
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-surface-2)', background: 'var(--color-canvas)' }}>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Name</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Role</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Organization</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Projects Count</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Status</th>
                      <th className="w-24 px-4 py-3 text-right" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => {
                      const isSelf = currentUserId === u.id
                      const isPending = !u.last_sign_in_at && !!u.invited_at

                      // Role Styles
                      const roleColors = {
                        admin: { bg: 'var(--color-accent-bg)', text: 'var(--accent)', border: 'var(--color-accent-light)' },
                        internal: { bg: 'var(--color-info-bg)', text: 'var(--color-info-text)', border: 'var(--color-info-border)' },
                        client: { bg: 'var(--color-success-bg)', text: 'var(--color-success-text)', border: 'var(--color-success-border)' },
                      }[u.role]

                      return (
                        <tr
                          key={u.id}
                          className="hover:bg-[var(--color-canvas)] border-b last:border-0 transition-colors duration-150"
                          style={{ borderColor: 'var(--color-surface-2)' }}
                        >
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-[var(--color-accent-bg)] text-[var(--accent)] font-semibold text-xs flex items-center justify-center border border-[var(--color-accent-light)] flex-shrink-0">
                                {(u.full_name ?? u.email ?? 'U').charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <span className="font-semibold text-[var(--color-text-primary)] block truncate">{u.full_name ?? '—'}</span>
                                <span className="text-[10px] text-[var(--color-text-secondary)] font-mono block truncate">{u.email ?? '—'}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <Badge variant={u.role === 'admin' ? 'accent' : u.role === 'internal' ? 'info' : 'success'} size="sm">
                              {u.role === 'admin' && <Shield size={10} />}
                              {ROLE_LABELS[u.role]}
                            </Badge>
                          </td>
                          <td className="px-4 py-3.5 font-medium text-[var(--color-text-secondary)]">
                            {u.client_org ?? '—'}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-[var(--color-text-primary)]">
                            {u.projects.length > 0 ? (
                              <span className="font-semibold text-[var(--accent)] underline cursor-pointer" onClick={() => setSelectedUser(u)}>
                                {u.projects.length} project{u.projects.length !== 1 ? 's' : ''}
                              </span>
                            ) : (
                              <span className="text-[var(--color-text-tertiary)]">none</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            {isPending ? (
                              <Badge variant="warning" size="sm">Invited</Badge>
                            ) : (
                              <Badge variant="success" size="sm">Active</Badge>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setSelectedUser(u)}
                                className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-150 cursor-pointer"
                                style={{ color: 'var(--color-text-secondary)' }}
                                title="View/Edit Settings"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                              {isSelf ? (
                                <span className="text-[10px] text-[var(--color-text-tertiary)] font-medium select-none px-1.5">Self</span>
                              ) : (
                                <button
                                  onClick={() => setDeleteTarget(u)}
                                  className="p-1.5 rounded-md hover:bg-[var(--color-danger-bg)] text-[var(--color-text-tertiary)] hover:text-[var(--color-danger-text)] transition-colors duration-150 cursor-pointer"
                                  title="Delete Account"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-[var(--color-text-tertiary)] bg-[var(--color-surface-0)] border-0">
                          No accounts match the filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          </TabsContent>

          <TabsContent value="projects" keepMounted>
            <div className="space-y-4">
            <div className="relative max-w-md w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--color-text-tertiary)]" />
              <Input
                placeholder="Search projects by name or description..."
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                className="pl-9 h-9.5 text-xs bg-[var(--color-surface-0)] border-[var(--color-surface-2)] focus:ring-[var(--accent)]"
              />
            </div>

            {loadingProjects ? (
              <div className="flex items-center justify-center py-20"><LoadingSpinner size="lg" /></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredProjects.map((p, idx) => (
                  <div
                    key={p.id}
                    className="p-5 rounded-xl border flex flex-col justify-between bg-[var(--color-surface-0)] hover:shadow-md transition-all duration-300 group animate-item-entrance"
                    style={{ borderColor: 'var(--color-surface-2)', animationDelay: `${idx * 30}ms` }}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-3 mb-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-bg)] text-[var(--accent)] flex items-center justify-center flex-shrink-0 border border-[var(--color-accent-light)]">
                            <FolderKanban size={15} />
                          </div>
                          <h3 className="font-semibold text-xs text-[var(--color-text-primary)] truncate max-w-[200px]" title={p.name}>
                            {p.name}
                          </h3>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setSelectedProject(p)}
                          className="h-7 text-[10px] border-[var(--color-surface-3)] hover:bg-[var(--color-accent-bg)] hover:text-[var(--accent)] font-semibold transition-all"
                        >
                          Manage Access
                        </Button>
                      </div>
                      <p className="text-[11px] text-[var(--color-text-secondary)] line-clamp-2 leading-relaxed mb-4">
                        {p.description ?? 'No project description provided.'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between border-t pt-3" style={{ borderColor: 'var(--color-surface-2)' }}>
                      <div className="flex gap-4">
                        <div className="flex flex-col">
                          <span className="text-[9px] uppercase font-bold tracking-wider text-[var(--color-text-tertiary)]">Deals</span>
                          <span className="text-xs font-semibold text-[var(--color-text-primary)] font-mono">{p.dealCount ?? 0}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] uppercase font-bold tracking-wider text-[var(--color-text-tertiary)]">Campaigns</span>
                          <span className="text-xs font-semibold text-[var(--color-text-primary)] font-mono">{p.campaignCount ?? 0}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] uppercase font-bold tracking-wider text-[var(--color-text-tertiary)]">Sponsors</span>
                          <span className="text-xs font-semibold text-[var(--color-text-primary)] font-mono">{p.sponsors?.[0]?.count ?? 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredProjects.length === 0 && (
                  <div className="col-span-2 text-center py-12 border border-dashed rounded-xl border-[var(--color-surface-3)] text-xs text-[var(--color-text-tertiary)] bg-[var(--color-surface-0)]">
                    No projects found in directory.
                  </div>
                )}
              </div>
            )}
          </div>
          </TabsContent>

          <TabsContent value="invitations" keepMounted>
            <div className="space-y-4">
            {loadingInvitations ? (
              <div className="flex items-center justify-center py-20">
                <LoadingSpinner size="lg" />
              </div>
            ) : (
              <div className="rounded-xl border overflow-hidden shadow-2xs" style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-surface-2)' }}>
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-surface-2)', background: 'var(--color-canvas)' }}>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Email</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Role</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Status</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Expires</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Invited By</th>
                      <th className="w-32 px-4 py-3 text-right" />
                    </tr>
                  </thead>
                  <tbody>
                    {invitations.map((inv) => {
                      const roleColors = {
                        admin: { bg: 'var(--color-accent-bg)', text: 'var(--accent)', border: 'var(--color-accent-light)' },
                        internal: { bg: 'var(--color-info-bg)', text: 'var(--color-info-text)', border: 'var(--color-info-border)' },
                        client: { bg: 'var(--color-success-bg)', text: 'var(--color-success-text)', border: 'var(--color-success-border)' },
                      }[inv.role] ?? { bg: 'transparent', text: 'var(--color-text-secondary)', border: 'var(--color-surface-2)' }

                      const acceptUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${inv.token}`

                      return (
                        <tr
                          key={inv.id}
                          className="hover:bg-[var(--color-canvas)] border-b last:border-0 transition-colors duration-150"
                          style={{ borderColor: 'var(--color-surface-2)' }}
                        >
                          <td className="px-4 py-3.5">
                            <span className="font-mono text-[var(--color-text-primary)] text-[12px]">{inv.email}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <Badge variant={inv.role === 'admin' ? 'accent' : inv.role === 'internal' ? 'info' : 'success'} size="sm">
                              {inv.role === 'admin' && <Shield size={10} />}
                              {inv.role === 'internal' ? 'Team' : inv.role === 'client' ? 'Sponsor' : 'Admin'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3.5">
                            <Badge
                              variant={
                                inv.status === 'accepted'
                                  ? 'success'
                                  : inv.status === 'expired'
                                    ? 'neutral'
                                    : inv.status === 'revoked'
                                      ? 'danger'
                                      : 'warning'
                              }
                              size="sm"
                            >
                               {inv.status === 'pending' && <Clock size={10} />}
                               {inv.status === 'accepted' && <Check size={10} />}
                               {inv.status === 'expired' && <XCircle size={10} />}
                               {inv.status === 'revoked' && <XCircle size={10} />}
                               {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                             </Badge>
                          </td>
                          <td className="px-4 py-3.5 text-[var(--color-text-secondary)]">
                            {new Date(inv.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-4 py-3.5 text-[var(--color-text-secondary)]">
                            {inv.invited_by_name}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(acceptUrl)
                                    setCopiedToken(inv.token)
                                    setTimeout(() => setCopiedToken(null), 2000)
                                  }}
                                  className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-150 cursor-pointer"
                                  style={{ color: 'var(--color-text-secondary)' }}
                                  title="Copy invitation link"
                                >
                                  {copiedToken === inv.token ? <Check className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} /> : <Copy className="h-3.5 w-3.5" />}
                                </button>
                                <button
                                  onClick={() => setDeleteInvitationTarget({ id: inv.id, email: inv.email })}
                                  className="p-1.5 rounded-md hover:bg-[var(--color-danger-bg)] text-[var(--color-text-tertiary)] hover:text-[var(--color-danger-text)] transition-colors duration-150 cursor-pointer"
                                  title="Delete invitation"
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    {invitations.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-[var(--color-text-tertiary)] bg-[var(--color-surface-0)] border-0">
                          <Mail className="h-5 w-5 mx-auto mb-2 opacity-40" />
                          No invitations yet. Click &ldquo;Invite Member&rdquo; to send one.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          </TabsContent>
        </div>
      </Tabs>

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleDataUpdated}
        projects={projects}
      />

      <DeleteUserDialog
        user={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={handleDataUpdated}
      />

      <DeleteInvitationDialog
        invitation={deleteInvitationTarget}
        onClose={() => setDeleteInvitationTarget(null)}
        onDeleted={handleDataUpdated}
      />

      <UserDetailDrawer
        user={selectedUser}
        open={selectedUser !== null}
        onClose={() => setSelectedUser(null)}
        onUpdated={handleDataUpdated}
        allProjects={projects}
      />

      <ProjectDetailDrawer
        project={selectedProject}
        open={selectedProject !== null}
        onClose={() => setSelectedProject(null)}
        onUpdated={handleDataUpdated}
        allUsers={users}
      />

      <DisconnectEmailDialog
        open={disconnectDialogOpen}
        onClose={() => setDisconnectDialogOpen(false)}
        onConfirm={disconnectSystemEmail}
      />
    </>
  )
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><LoadingSpinner size="lg" /></div>}>
      <AdminDashboardContent />
    </Suspense>
  )
}
