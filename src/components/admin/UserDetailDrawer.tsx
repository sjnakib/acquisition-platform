'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Plus, Trash2, FolderKanban, Shield, Sparkles, Building2, Calendar, UserCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
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
}

interface UserDetailDrawerProps {
  user: UserRow | null
  open: boolean
  onClose: () => void
  onUpdated: () => void
  allProjects: Project[]
}

export function UserDetailDrawer({ user, open, onClose, onUpdated, allProjects }: UserDetailDrawerProps) {
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<'internal' | 'client' | 'admin'>('internal')
  const [clientOrg, setClientOrg] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  
  const [savingProfile, setSavingProfile] = useState(false)
  const [assigningProject, setAssigningProject] = useState(false)
  const [unassigningProject, setUnassigningProject] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (user) {
      setFullName(user.full_name ?? '')
      setRole(user.role)
      setClientOrg(user.client_org ?? '')
      setSelectedProjectId('')
    }
  }, [user])

  if (!open || !user || !mounted) return null

  const assignedProjectIds = new Set(user.projects.map((p) => p.id))
  const availableProjects = allProjects.filter((p) => !assignedProjectIds.has(p.id))

  const isInvitePending = !user.last_sign_in_at && !!user.invited_at

  async function handleSaveProfile() {
    if (!user) return
    setSavingProfile(true)
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName || undefined,
          role,
          client_org: role === 'client' ? clientOrg : null,
        }),
      })

      if (!res.ok) {
        throw new Error(await res.text())
      }

      toast.success('User profile updated successfully')
      onUpdated()
    } catch (err) {
      console.error('Failed to update profile:', err)
      toast.error('Failed to update user profile')
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleAssignProject() {
    if (!user || !selectedProjectId) return
    setAssigningProject(true)
    try {
      let res
      if (user.role === 'client') {
        res = await fetch(`/api/projects/${selectedProjectId}/sponsors`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.email }),
        })
      } else {
        res = await fetch(`/api/projects/${selectedProjectId}/members`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id }),
        })
      }

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to assign project')
      }

      toast.success('Project assigned successfully')
      setSelectedProjectId('')
      onUpdated()
    } catch (err) {
      console.error('Failed to assign project:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to assign project')
    } finally {
      setAssigningProject(false)
    }
  }

  async function handleUnassignProject(proj: UserProject) {
    if (!user) return
    setUnassigningProject(proj.id)
    try {
      let url = ''
      if (user.role === 'client' && proj.sponsorId) {
        url = `/api/projects/${proj.id}/sponsors?sponsorId=${proj.sponsorId}`
      } else if (proj.memberId) {
        url = `/api/projects/${proj.id}/members?memberId=${proj.memberId}`
      }

      if (!url) throw new Error('Missing assignment ID')

      const res = await fetch(url, { method: 'DELETE' })

      if (!res.ok) {
        throw new Error(await res.text())
      }

      toast.success('Project unassigned successfully')
      onUpdated()
    } catch (err) {
      console.error('Failed to unassign project:', err)
      toast.error('Failed to remove project access')
    } finally {
      setUnassigningProject(null)
    }
  }

  const initials = (user.full_name ?? user.email ?? 'U').charAt(0).toUpperCase()

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 animate-overlay-show" 
        style={{ background: 'var(--color-overlay)', backdropFilter: 'blur(2px)' }} 
        onClick={onClose}
      />

      {/* Slide-over sheet */}
      <div 
        className="relative w-full max-w-md h-full flex flex-col shadow-xl border-l animate-sheet-slide-in-right z-10"
        style={{ 
          background: 'var(--color-surface-0)', 
          borderColor: 'var(--color-surface-2)' 
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: 'var(--color-surface-2)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-bg)] text-[var(--accent)] font-semibold text-sm flex items-center justify-center border border-[var(--color-accent-light)]">
              {initials}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">{user.full_name ?? 'Unnamed User'}</h2>
              <p className="text-[11px] text-[var(--color-text-secondary)] font-mono truncate max-w-[200px]">{user.email}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* User Status Card */}
          <div className="p-4 rounded-xl border flex gap-3 items-center bg-[var(--color-canvas)]" style={{ borderColor: 'var(--color-surface-2)' }}>
            {isInvitePending ? (
              <>
                <div className="p-2 rounded-lg bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]">
                  <Calendar size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-[var(--color-text-primary)]">Pending Invitation</h4>
                  <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">
                    Invited {user.invited_at ? new Date(user.invited_at).toLocaleDateString() : 'recently'}. Awaiting setup.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="p-2 rounded-lg bg-[var(--color-success-bg)] text-[var(--color-success-text)]">
                  <UserCheck size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-[var(--color-text-primary)]">Active Account</h4>
                  <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">
                    Last active: {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'N/A'}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Profile Edit Form */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Profile Settings</h3>
            
            <div className="space-y-3 p-4 border rounded-xl" style={{ borderColor: 'var(--color-surface-2)', background: 'var(--color-surface-0)' }}>
              <div>
                <Label className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-text-secondary)] mb-1">Full Name</Label>
                <Input 
                  value={fullName} 
                  onChange={(e) => setFullName(e.target.value)} 
                  className="text-xs h-9" 
                  placeholder="Jane Smith"
                />
              </div>

              <div>
                <Label className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-text-secondary)] mb-1">System Role</Label>
                <Select value={role} onValueChange={(val: any) => setRole(val)}>
                  <SelectTrigger className="text-xs h-9 bg-[var(--color-surface-0)] border-[var(--color-surface-2)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--color-surface-0)] border-[var(--color-surface-2)]">
                    <SelectItem className="text-xs focus:bg-[var(--color-accent-bg)]" value="internal">Team Member (Internal)</SelectItem>
                    <SelectItem className="text-xs focus:bg-[var(--color-accent-bg)]" value="client">Sponsor (Client)</SelectItem>
                    <SelectItem className="text-xs focus:bg-[var(--color-accent-bg)]" value="admin">System Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {role === 'client' && (
                <div>
                  <Label className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-text-secondary)] mb-1">Organization</Label>
                  <Input 
                    value={clientOrg} 
                    onChange={(e) => setClientOrg(e.target.value)} 
                    className="text-xs h-9" 
                    placeholder="Acme Capital"
                  />
                </div>
              )}

              <div className="flex justify-end pt-1">
                <Button 
                  onClick={handleSaveProfile} 
                  disabled={savingProfile} 
                  size="sm"
                  style={{ background: 'var(--accent)', color: 'var(--color-text-inverse)' }}
                  className="h-8 shadow-xs text-xs"
                >
                  {savingProfile ? <LoadingSpinner size="sm" /> : 'Save Changes'}
                </Button>
              </div>
            </div>
          </div>

          {/* Project Assignments */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Project Access Control</h3>

            {/* Assign Project Form */}
            <div className="p-4 border rounded-xl space-y-3 bg-[var(--color-surface-0)]" style={{ borderColor: 'var(--color-surface-2)' }}>
              <div>
                <Label className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-text-secondary)] mb-1">Assign to Project</Label>
                <div className="flex gap-2">
                  <Select value={selectedProjectId} onValueChange={setSelectedProjectId} disabled={availableProjects.length === 0}>
                    <SelectTrigger className="text-xs h-9 flex-1 bg-[var(--color-surface-0)] border-[var(--color-surface-2)]">
                      <SelectValue placeholder={availableProjects.length === 0 ? "No projects available to assign" : "Select project..."} />
                    </SelectTrigger>
                    <SelectContent className="bg-[var(--color-surface-0)] border-[var(--color-surface-2)]">
                      {availableProjects.map((p) => (
                        <SelectItem key={p.id} className="text-xs focus:bg-[var(--color-accent-bg)]" value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    onClick={handleAssignProject} 
                    disabled={assigningProject || !selectedProjectId} 
                    size="sm"
                    style={{ background: 'var(--accent)', color: 'var(--color-text-inverse)' }}
                    className="h-9 px-3"
                  >
                    {assigningProject ? <LoadingSpinner size="sm" /> : <Plus size={14} />}
                  </Button>
                </div>
              </div>
            </div>

            {/* Project List */}
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-text-tertiary)] pl-0.5">
                Current Access ({user.projects.length})
              </Label>
              {user.projects.length === 0 ? (
                <div className="text-center py-8 border border-dashed rounded-xl border-[var(--color-surface-3)] text-xs text-[var(--color-text-tertiary)] bg-[var(--color-canvas)]">
                  No project memberships assigned. This user cannot view any data.
                </div>
              ) : (
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                  {user.projects.map((proj) => (
                    <div 
                      key={proj.id} 
                      className="flex items-center justify-between p-3 rounded-lg border bg-[var(--color-canvas)]" 
                      style={{ borderColor: 'var(--color-surface-2)' }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FolderKanban size={13} className="text-[var(--color-text-secondary)] flex-shrink-0" />
                        <span className="text-xs font-medium text-[var(--color-text-primary)] truncate font-sans">{proj.name}</span>
                      </div>
                      <button 
                        onClick={() => handleUnassignProject(proj)}
                        disabled={unassigningProject === proj.id}
                        className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-[var(--color-text-tertiary)] hover:text-[var(--color-danger-text)] transition-colors cursor-pointer"
                        title="Remove Access"
                      >
                        {unassigningProject === proj.id ? <LoadingSpinner size="sm" /> : <Trash2 size={12} />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
