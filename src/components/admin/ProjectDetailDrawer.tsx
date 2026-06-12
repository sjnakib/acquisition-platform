'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Plus, Trash2, Users, Building2, Shield, FolderKanban } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Project {
  id: string
  name: string
  description: string | null
  created_at: string
}

interface Member {
  id: string
  user_id: string
  full_name: string | null
  email: string | null
  role: string
}

interface Sponsor {
  id: string
  user_id: string
  full_name: string | null
  email: string | null
}

interface UserRow {
  id: string
  email: string | null
  full_name: string | null
  role: 'internal' | 'client' | 'admin'
  client_org: string | null
}

interface ProjectDetailDrawerProps {
  project: Project | null
  open: boolean
  onClose: () => void
  onUpdated: () => void
  allUsers: UserRow[]
}

export function ProjectDetailDrawer({ project, open, onClose, onUpdated, allUsers }: ProjectDetailDrawerProps) {
  const queryClient = useQueryClient()
  const [selectedMemberId, setSelectedMemberId] = useState<string>('')
  const [selectedSponsorId, setSelectedSponsorId] = useState<string>('')

  const { data: members = [], isLoading: loadingMembers } = useQuery<Member[]>({
    queryKey: ['project', project?.id, 'members'],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${project!.id}/members`)
      if (!res.ok) throw new Error('Failed to load project members')
      return res.json()
    },
    enabled: open && !!project,
  })

  const { data: sponsors = [], isLoading: loadingSponsors } = useQuery<Sponsor[]>({
    queryKey: ['project', project?.id, 'sponsors'],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${project!.id}/sponsors`)
      if (!res.ok) throw new Error('Failed to load project sponsors')
      return res.json()
    },
    enabled: open && !!project,
  })

  const addMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/projects/${project!.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Failed to add member')
      }
    },
    onSuccess: () => {
      toast.success('Team member assigned to project')
      setSelectedMemberId('')
      queryClient.invalidateQueries({ queryKey: ['project', project?.id, 'members'] })
      onUpdated()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to add member'),
  })

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const res = await fetch(`/api/projects/${project!.id}/members?memberId=${memberId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to remove member')
    },
    onSuccess: () => {
      toast.success('Team member unassigned')
      queryClient.invalidateQueries({ queryKey: ['project', project?.id, 'members'] })
      onUpdated()
    },
    onError: () => toast.error('Failed to remove member'),
  })

  const addSponsorMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await fetch(`/api/projects/${project!.id}/sponsors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Failed to add sponsor')
      }
    },
    onSuccess: () => {
      toast.success('Sponsor linked to project')
      setSelectedSponsorId('')
      queryClient.invalidateQueries({ queryKey: ['project', project?.id, 'sponsors'] })
      onUpdated()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to add sponsor'),
  })

  const removeSponsorMutation = useMutation({
    mutationFn: async (sponsorId: string) => {
      const res = await fetch(`/api/projects/${project!.id}/sponsors?sponsorId=${sponsorId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to remove sponsor')
    },
    onSuccess: () => {
      toast.success('Sponsor unlinked')
      queryClient.invalidateQueries({ queryKey: ['project', project?.id, 'sponsors'] })
      onUpdated()
    },
    onError: () => toast.error('Failed to remove sponsor'),
  })

  if (!open || !project) return null

  // Filter available members (internal users not already in members)
  const currentMemberUserIds = new Set(members.map((m) => m.user_id))
  const availableMembers = allUsers.filter(
    (u) => (u.role === 'internal' || u.role === 'admin') && !currentMemberUserIds.has(u.id)
  )

  // Filter available sponsors (client users not already in sponsors)
  const currentSponsorUserIds = new Set(sponsors.map((s) => s.user_id))
  const availableSponsors = allUsers.filter(
    (u) => u.role === 'client' && !currentSponsorUserIds.has(u.id)
  )

  return (
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
            <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-bg)] text-[var(--accent)] flex items-center justify-center border border-[var(--color-accent-light)]">
              <FolderKanban size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)] truncate max-w-[220px]">{project.name}</h2>
              <p className="text-[10px] text-[var(--color-text-secondary)] font-mono">
                Created: {new Date(project.created_at).toLocaleDateString()}
              </p>
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
          {project.description && (
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-text-tertiary)] pl-0.5">Description</Label>
              <div className="p-3 border rounded-xl bg-[var(--color-canvas)] text-xs text-[var(--color-text-secondary)] leading-relaxed" style={{ borderColor: 'var(--color-surface-2)' }}>
                {project.description}
              </div>
            </div>
          )}

          {/* Section 1: Team Members (Internal Users) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--color-surface-2)' }}>
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                <Users size={14} className="text-[var(--accent)]" />
                <span>Internal Team Members ({members.length})</span>
              </div>
            </div>

            {/* Assign Member Input */}
            <div className="flex gap-2">
              <Select 
                value={selectedMemberId} 
                onValueChange={setSelectedMemberId} 
                disabled={availableMembers.length === 0}
              >
                <SelectTrigger className="text-xs h-8.5 bg-[var(--color-surface-0)] border-[var(--color-surface-2)] flex-1">
                  <SelectValue placeholder={availableMembers.length === 0 ? "No team members available to assign" : "Select team member..."} />
                </SelectTrigger>
                <SelectContent className="bg-[var(--color-surface-0)] border-[var(--color-surface-2)]">
                  {availableMembers.map((u) => (
                    <SelectItem key={u.id} className="text-xs focus:bg-[var(--color-accent-bg)]" value={u.id}>
                      {u.full_name ?? u.email ?? 'Unnamed'} {u.role === 'admin' ? '(Admin)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={() => addMemberMutation.mutate(selectedMemberId)} 
                disabled={addMemberMutation.isPending || !selectedMemberId} 
                size="sm"
                style={{ background: 'var(--accent)', color: 'var(--color-text-inverse)' }}
                className="h-8.5 px-3"
              >
                {addMemberMutation.isPending ? <LoadingSpinner size="sm" /> : <Plus size={13} />}
              </Button>
            </div>

            {/* Members List */}
            {loadingMembers ? (
              <div className="flex items-center justify-center py-4"><LoadingSpinner size="sm" /></div>
            ) : members.length === 0 ? (
              <div className="text-center py-6 border border-dashed rounded-xl border-[var(--color-surface-3)] text-xs text-[var(--color-text-tertiary)] bg-[var(--color-canvas)]">
                No team members assigned yet.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between p-2.5 rounded-lg border bg-[var(--color-surface-0)]" style={{ borderColor: 'var(--color-surface-2)' }}>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                        {m.full_name ?? 'Unnamed'}
                      </div>
                      <div className="text-[10px] text-[var(--color-text-secondary)] font-mono truncate">{m.email}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold uppercase bg-[var(--color-neutral-bg)] text-[var(--color-neutral-text)] px-1.5 py-0.5 rounded border border-[var(--color-neutral-border)]">
                        {m.role}
                      </span>
                      <button 
                        onClick={() => removeMemberMutation.mutate(m.id)}
                        disabled={removeMemberMutation.isPending}
                        className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-[var(--color-text-tertiary)] hover:text-var(--color-danger-text) transition-colors cursor-pointer"
                        title="Remove Member"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Sponsors (Client Users) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--color-surface-2)' }}>
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                <Building2 size={14} className="text-[var(--accent)]" />
                <span>Sponsors & Investors ({sponsors.length})</span>
              </div>
            </div>

            {/* Assign Sponsor Input */}
            <div className="flex gap-2">
              <Select 
                value={selectedSponsorId} 
                onValueChange={setSelectedSponsorId} 
                disabled={availableSponsors.length === 0}
              >
                <SelectTrigger className="text-xs h-8.5 bg-[var(--color-surface-0)] border-[var(--color-surface-2)] flex-1">
                  <SelectValue placeholder={availableSponsors.length === 0 ? "No client sponsors available to assign" : "Select sponsor..."} />
                </SelectTrigger>
                <SelectContent className="bg-[var(--color-surface-0)] border-[var(--color-surface-2)]">
                  {availableSponsors.map((u) => (
                    <SelectItem key={u.id} className="text-xs focus:bg-[var(--color-accent-bg)]" value={u.id}>
                      {u.full_name ?? u.email ?? 'Unnamed'} {u.client_org ? `(${u.client_org})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={() => {
                  const u = allUsers.find(user => user.id === selectedSponsorId)
                  if (u?.email) {
                    addSponsorMutation.mutate(u.email)
                  }
                }} 
                disabled={addSponsorMutation.isPending || !selectedSponsorId} 
                size="sm"
                style={{ background: 'var(--accent)', color: 'var(--color-text-inverse)' }}
                className="h-8.5 px-3"
              >
                {addSponsorMutation.isPending ? <LoadingSpinner size="sm" /> : <Plus size={13} />}
              </Button>
            </div>

            {/* Sponsors List */}
            {loadingSponsors ? (
              <div className="flex items-center justify-center py-4"><LoadingSpinner size="sm" /></div>
            ) : sponsors.length === 0 ? (
              <div className="text-center py-6 border border-dashed rounded-xl border-[var(--color-surface-3)] text-xs text-[var(--color-text-tertiary)] bg-[var(--color-canvas)]">
                No sponsors assigned yet.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                {sponsors.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-2.5 rounded-lg border bg-[var(--color-surface-0)]" style={{ borderColor: 'var(--color-surface-2)' }}>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                        {s.full_name ?? 'Unnamed Sponsor'}
                      </div>
                      <div className="text-[10px] text-[var(--color-text-secondary)] font-mono truncate">{s.email}</div>
                    </div>
                    <button 
                      onClick={() => removeSponsorMutation.mutate(s.id)}
                      disabled={removeSponsorMutation.isPending}
                      className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-[var(--color-text-tertiary)] hover:text-var(--color-danger-text) transition-colors cursor-pointer"
                      title="Remove Sponsor"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
