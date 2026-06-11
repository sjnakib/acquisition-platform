'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/shared/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { useProjectContext } from '@/components/shared/ProjectContext'
import { pageHeadings } from '@/lib/page-headings'
import { Trash2, Plus, Save, Folder, ExternalLink, Settings, Users, Link2, AlertTriangle, ShieldAlert } from 'lucide-react'
import { DriveFolderPicker } from '@/components/projects/DriveFolderPicker'
import { toast } from 'sonner'
import { RemoveSponsorDialog } from '@/components/projects/RemoveSponsorDialog'

interface Sponsor {
  id: string
  user_id: string
  email: string | null
  full_name: string | null
  created_at: string
}

export default function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params)
  const { projectName } = useProjectContext()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [sponsorEmail, setSponsorEmail] = useState('')
  const [sponsorName, setSponsorName] = useState('')
  const [showFolderPicker, setShowFolderPicker] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [removingSponsor, setRemovingSponsor] = useState<Sponsor | null>(null)

  const { data: project, isLoading: loading } = useQuery<{
    name: string; description: string | null
    google_connections: { google_email: string } | null
  }>({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`)
      if (!res.ok) throw new Error('Failed to load project')
      return res.json()
    },
  })

  const { data: sponsors = [] } = useQuery<Sponsor[]>({
    queryKey: ['project', projectId, 'sponsors'],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/sponsors`)
      if (!res.ok) throw new Error('Failed to load sponsors')
      return res.json()
    },
  })

  const { data: workingFolder = null } = useQuery<{ folderId: string; folderUrl: string; name: string } | null>({
    queryKey: ['project', projectId, 'drive', 'working-folder'],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/drive/working-folder`)
      if (!res.ok) return null
      const data = await res.json()
      return data.workingFolder ?? null
    },
  })

  useEffect(() => {
    if (project) {
      setName(project.name ?? '')
      setDescription(project.description ?? '')
    }
  }, [project])

  const gmailConnected = !!project?.google_connections?.google_email
  const gmailEmail = project?.google_connections?.google_email ?? null

  // Check Gmail connection status from URL param after OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('gmail') === 'connected') {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [projectId, queryClient])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Failed to save project')
      }
    },
    onSuccess: () => {
      toast.success('Project saved')
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to save project'),
  })

  const addSponsorMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/sponsors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: sponsorEmail, full_name: sponsorName || undefined }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Failed to add sponsor')
      }
    },
    onSuccess: () => {
      toast.success('Sponsor added')
      setSponsorEmail('')
      setSponsorName('')
      queryClient.invalidateQueries({ queryKey: ['project', projectId, 'sponsors'] })
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to add sponsor'),
  })

  const removeSponsorMutation = useMutation({
    mutationFn: async (sponsorId: string) => {
      const res = await fetch(`/api/projects/${projectId}/sponsors?sponsorId=${sponsorId}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Failed to remove sponsor')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId, 'sponsors'] })
    },
  })

  const disconnectGmailMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/google/disconnect`, { method: 'POST' })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Failed to disconnect Gmail')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      toast.success('Gmail disconnected')
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to disconnect Gmail'),
  })

  const setWorkingFolderMutation = useMutation({
    mutationFn: async (folderId: string) => {
      const res = await fetch(`/api/projects/${projectId}/drive/working-folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? `Failed to set working folder (${res.status})`)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId, 'drive', 'working-folder'] })
    },
    onError: (err) => {
      throw err // re-throw for DriveFolderPicker to handle
    },
  })

  const removeWorkingFolderMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/drive/working-folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId: null }),
      })
      if (!res.ok) throw new Error('Failed to remove working folder')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId, 'drive', 'working-folder'] })
      toast.success('Working folder removed')
    },
    onError: () => toast.error('Failed to remove working folder'),
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Failed to delete project')
      }
    },
    onSuccess: () => {
      toast.success('Project deleted')
      router.push('/projects')
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to delete project'),
  })

  const addSponsor = () => {
    if (!sponsorEmail) return
    addSponsorMutation.mutate()
  }

  const removeSponsor = (sponsorId: string) => removeSponsorMutation.mutate(sponsorId)

  const saveProject = () => saveMutation.mutate()

  const disconnectGmail = () => disconnectGmailMutation.mutate()

  const setWorkingFolderHandler = (folderId: string) => setWorkingFolderMutation.mutateAsync(folderId)

  const removeWorkingFolder = () => removeWorkingFolderMutation.mutate()

  const deleteProject = () => {
    if (deleteConfirm !== 'DELETE') return
    deleteMutation.mutate()
  }

  if (loading) {
    return (
      <div>
        <PageHeader
          title="Settings"
          description={pageHeadings.settings.description}
          breadcrumb={[
            { label: 'Projects', href: '/projects' },
            { label: projectName, href: `/projects/${projectId}/settings` },
            { label: 'Settings' },
          ]}
        />
        <div className="flex items-center justify-center py-20"><LoadingSpinner size="lg" /></div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description={pageHeadings.settings.description}
        breadcrumb={[
          { label: 'Projects', href: '/projects' },
          { label: projectName, href: `/projects/${projectId}/settings` },
          { label: 'Settings' },
        ]}
      />

      <div className="space-y-8 max-w-3xl mx-auto w-full pb-16">
        {/* Section 1: General Info */}
        <div 
          className="animate-item-entrance rounded-xl border p-6" 
          style={{ 
            background: 'var(--color-surface-0)', 
            borderColor: 'var(--color-surface-2)', 
            boxShadow: 'var(--shadow-sm)',
            animationDelay: '0ms'
          }}
        >
          <div className="flex items-center gap-2.5 pb-3 mb-5 border-b border-[var(--color-surface-2)]">
            <div className="p-1.5 rounded-lg bg-[var(--color-accent-bg)] text-[var(--accent)]">
              <Settings size={16} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">General Settings</h2>
              <p className="text-[11px] text-[var(--color-text-secondary)]">Manage the basic project metadata and descriptions.</p>
            </div>
          </div>
          
          <div className="space-y-4 w-full">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Project Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-[var(--color-canvas)] border-[var(--color-surface-2)] focus:ring-[var(--accent)] text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="bg-[var(--color-canvas)] border-[var(--color-surface-2)] resize-none focus:ring-[var(--accent)] text-xs"
              />
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={saveProject} disabled={saveMutation.isPending} style={{ background: 'var(--accent)', color: 'var(--color-text-inverse)' }} className="shadow-xs flex items-center gap-1.5 h-9">
                {saveMutation.isPending ? <LoadingSpinner size="sm" /> : <Save size={14} />}
                {saveMutation.isPending ? 'Saving Changes...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>

        {/* Section 2: Google Workspace (Merged Integration Card) */}
        <div 
          className="animate-item-entrance rounded-xl border p-6" 
          style={{ 
            background: 'var(--color-surface-0)', 
            borderColor: 'var(--color-surface-2)', 
            boxShadow: 'var(--shadow-sm)',
            animationDelay: '75ms'
          }}
        >
          <div className="flex items-center gap-2.5 pb-3 mb-5 border-b border-[var(--color-surface-2)]">
            <div className="p-1.5 rounded-lg bg-[var(--color-accent-bg)] text-[var(--accent)]">
              <Link2 size={16} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Google Workspace Integration</h2>
              <p className="text-[11px] text-[var(--color-text-secondary)]">Manage connected services powered by your Google Account credentials.</p>
            </div>
          </div>

          {!gmailConnected ? (
            <div className="flex flex-col items-center justify-center text-center p-8 border border-dashed border-[var(--color-surface-3)] rounded-xl bg-[var(--color-canvas)] py-10">
              <div className="w-12 h-12 rounded-full bg-[var(--color-surface-0)] border border-[var(--color-surface-2)] flex items-center justify-center shadow-xs mb-4">
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.77-.07-1.54-.2-2.27H12v4.51h6.6c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.68-5.17 3.68-8.82z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 22.25 7.37 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.27 14.29a7.18 7.18 0 0 1 0-4.58V6.62H1.29a11.94 11.94 0 0 0 0 10.76l3.98-3.09z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.37 0 3.26 1.75 1.29 4.75l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
                  />
                </svg>
              </div>
              <h3 className="text-xs font-semibold text-[var(--color-text-primary)] mb-1">Unified Google Integration</h3>
              <p className="text-[11px] text-[var(--color-text-tertiary)] max-w-sm mb-6 leading-relaxed">
                Connect your Google Account to authorize email communications (Gmail) and document storage organization (Google Drive) under a single sign-on.
              </p>
              <Button asChild style={{ background: 'var(--accent)', color: 'var(--color-text-inverse)' }} className="h-9 px-6 rounded-lg text-xs font-medium shadow-xs">
                <a href={`/api/auth/google?projectId=${projectId}`}>Connect Google Account</a>
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Account Node (Parent) */}
              <div className="p-4 rounded-xl border border-[var(--color-surface-2)] bg-[var(--color-canvas)]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-[var(--color-surface-0)] border border-[var(--color-surface-2)] flex items-center justify-center flex-shrink-0 shadow-xs">
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M23.745 12.27c0-.77-.07-1.54-.2-2.27H12v4.51h6.6c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.68-5.17 3.68-8.82z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 22.25 7.37 24 12 24z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.27 14.29a7.18 7.18 0 0 1 0-4.58V6.62H1.29a11.94 11.94 0 0 0 0 10.76l3.98-3.09z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.37 0 3.26 1.75 1.29 4.75l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
                        />
                      </svg>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-[var(--color-text-primary)]">Google Integration Account</span>
                      <span className="text-[11px] text-[var(--color-text-secondary)] font-mono truncate">{gmailEmail ?? 'Connected Account'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 self-end sm:self-center">
                    <Badge variant="success" dot size="sm">Connected</Badge>
                    <Button variant="outline" size="sm" onClick={disconnectGmail} disabled={disconnectGmailMutation.isPending} className="h-8 text-xs border-[var(--color-surface-3)] hover:bg-[var(--color-danger-border)] hover:text-[var(--color-danger-text)] bg-[var(--color-surface-0)] transition-colors duration-200">
                      {disconnectGmailMutation.isPending ? <LoadingSpinner size="sm" /> : 'Disconnect Account'}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Branching tree representation */}
              <div className="relative pl-6 ml-9 border-l border-dashed border-[var(--color-surface-3)] space-y-6">
                
                {/* Branch 1: Gmail Service */}
                <div className="relative">
                  {/* Connector Dot */}
                  <span className="absolute -left-[29px] top-[27px] w-2.5 h-2.5 rounded-full bg-[#4285F4] border-2 border-[var(--color-surface-0)] shadow-3xs" />
                  
                  <div className="p-4 rounded-xl border border-[var(--color-surface-2)] bg-[var(--color-canvas)]">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[var(--color-surface-0)] border border-[var(--color-surface-2)] flex items-center justify-center shadow-2xs flex-shrink-0">
                        <svg viewBox="0 0 32 32" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
                          <path d="M16.58,19.1068l-12.69-8.0757A3,3,0,0,1,7.1109,5.97l9.31,5.9243L24.78,6.0428A3,3,0,0,1,28.22,10.9579Z" fill="#ea4435"/>
                          <path d="M25.5,5.5h4v18a3,3,0,0,1-3,3h0a3,3,0,0,1-3-3V7.5a2,2,0,0,1,2-2Z" fill="#34A853" transform="translate(53.0001 32.0007) rotate(180)"/>
                          <path d="M29.4562,8.0656c-.0088-.06-.0081-.1213-.0206-.1812-.0192-.0918-.0549-.1766-.0823-.2652a2.9312,2.9312,0,0,0-.0958-.2993c-.02-.0475-.0508-.0892-.0735-.1354A2.9838,2.9838,0,0,0,28.9686,6.8c-.04-.0581-.09-.1076-.1342-.1626a3.0282,3.0282,0,0,0-.2455-.2849c-.0665-.0647-.1423-.1188-.2146-.1771a3.02,3.02,0,0,0-.24-.1857c-.0793-.0518-.1661-.0917-.25-.1359-.0884-.0461-.175-.0963-.267-.1331-.0889-.0358-.1837-.0586-.2766-.0859s-.1853-.06-.2807-.0777a3.0543,3.0543,0,0,0-.357-.036c-.0759-.0053-.1511-.0186-.2273-.018a2.9778,2.9778,0,0,0-.4219.0425c-.0563.0084-.113.0077-.1689.0193a33.211,33.211,0,0,0-.5645.178c-.0515.022-.0966.0547-.1465.0795A2.901,2.901,0,0,0,23.5,8.5v5.762l4.72-3.3043a2.8878,2.8878,0,0,0,1.2359-2.8923Z" fill="#ffba00"/>
                          <path d="M5.5,5.5h0a3,3,0,0,1,3,3v18a0,0,0,0,1,0,0h-4a2,2,0,0,1-2-2V8.5a3,3,0,0,1,3-3Z" fill="#4285f4"/>
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[var(--color-text-primary)]">Gmail outreach & reply tracking</span>
                          <span className="text-[9px] font-semibold bg-[var(--color-success-bg)] text-[var(--color-success-text)] px-1.5 py-0.5 rounded-full border border-[var(--color-success-border)]">Active</span>
                        </div>
                        <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5 leading-relaxed">
                          Automated email sequences and incoming owner responses synchronize directly through this Google Account.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Branch 2: Google Drive Service */}
                <div className="relative">
                  {/* Connector Dot */}
                  <span className="absolute -left-[29px] top-[27px] w-2.5 h-2.5 rounded-full bg-[#34A853] border-2 border-[var(--color-surface-0)] shadow-3xs" />

                  <div className="p-4 rounded-xl border border-[var(--color-surface-2)] bg-[var(--color-canvas)] space-y-4">
                    <div className="flex items-center justify-between gap-4 pb-3 border-b border-[var(--color-surface-2)]">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[var(--color-surface-0)] border border-[var(--color-surface-2)] flex items-center justify-center shadow-2xs flex-shrink-0">
                          <svg viewBox="0 0 87.3 78" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
                            <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                            <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
                            <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                            <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                            <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                            <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-semibold text-[var(--color-text-primary)]">Google Drive workspace storage</span>
                          <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5 leading-relaxed">
                            Organizes checklist items and documents in the project's Drive folder under the same account.
                          </p>
                        </div>
                      </div>
                      {!workingFolder && (
                        <Button onClick={() => setShowFolderPicker(true)} disabled={setWorkingFolderMutation.isPending} size="sm" style={{ background: 'var(--accent)', color: 'var(--color-text-inverse)' }} className="h-8 shadow-xs">
                          {setWorkingFolderMutation.isPending ? <LoadingSpinner size="sm" /> : <Folder size={12} className="mr-1" />}
                          Set Folder
                        </Button>
                      )}
                    </div>

                    {workingFolder ? (
                      <div className="space-y-4 pt-1">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 rounded-lg border border-[var(--color-surface-2)] bg-[var(--color-surface-0)] shadow-3xs">
                          <div className="flex items-center gap-3 min-w-0">
                            <Folder className="w-5 h-5 flex-shrink-0 text-[var(--color-text-secondary)]" />
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-semibold text-[var(--color-text-primary)]">Connected Drive Root</span>
                              <span className="text-[10px] text-[var(--color-text-secondary)] font-mono truncate max-w-[200px] mt-0.5" title={workingFolder.folderId}>
                                ID: {workingFolder.folderId}
                              </span>
                              <a
                                href={workingFolder.folderUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] hover:underline inline-flex items-center gap-1 text-[var(--accent)] font-semibold mt-1"
                              >
                                View folder in Google Drive <ExternalLink size={10} />
                              </a>
                            </div>
                          </div>
                          <div className="flex gap-2 self-end sm:self-center">
                            <Button variant="outline" size="sm" onClick={() => setShowFolderPicker(true)} disabled={setWorkingFolderMutation.isPending} className="h-7 text-[10px] border-[var(--color-surface-3)] bg-[var(--color-surface-0)] px-2">
                              Change
                            </Button>
                            <Button variant="outline" size="sm" onClick={removeWorkingFolder} className="h-7 text-[10px] border-[var(--color-danger-border)] text-[var(--color-danger-text)] hover:bg-[var(--color-danger-bg)] px-2">
                              Remove
                            </Button>
                          </div>
                        </div>

                        {/* Mapping Schema visualization */}
                        <div className="rounded-lg border border-[var(--color-surface-2)] bg-[var(--color-surface-0)] p-4">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-2.5">Workspace Folder Mapping Schema</p>
                          <div className="font-mono text-[11px] text-[var(--color-text-secondary)] leading-relaxed space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-amber-500">📁</span>
                              <span className="font-semibold text-[var(--color-text-primary)] font-mono text-[10px] truncate max-w-[180px]" title={workingFolder.folderId}>{workingFolder.folderId}</span>
                              <span className="text-[9px] bg-[var(--color-surface-2)] text-[var(--color-text-tertiary)] px-1.5 py-0.5 rounded font-sans flex-shrink-0">Root</span>
                            </div>
                            <div className="pl-4 text-[var(--color-surface-3)]">└── <span className="text-amber-500">📁</span> <span className="text-[var(--color-text-primary)]">[Property Address]</span> <span className="text-[9px] bg-[var(--color-surface-2)] text-[var(--color-text-tertiary)] px-1.5 py-0.5 rounded font-sans">Deal Folder</span></div>
                            <div className="pl-8 text-[var(--color-surface-3)]">├── <span className="text-green-600">📊</span> <span className="text-[var(--color-text-secondary)]">Underwriting Spreadsheet.xlsx</span></div>
                            <div className="pl-8 text-[var(--color-surface-3)]">├── <span className="text-red-500">📄</span> <span className="text-[var(--color-text-secondary)]">Diligence Checklist.pdf</span></div>
                            <div className="pl-8 text-[var(--color-surface-3)]">└── <span className="text-amber-500">📁</span> <span className="text-[var(--color-text-tertiary)]">Attachments/</span></div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2 flex flex-col items-center justify-center text-center p-6 border border-dashed border-[var(--color-surface-2)] rounded-lg bg-[var(--color-surface-0)] py-8">
                        <div className="w-10 h-10 rounded-full bg-[var(--color-canvas)] border border-[var(--color-surface-2)] flex items-center justify-center text-[var(--color-text-tertiary)] mb-2.5">
                          <Folder size={18} />
                        </div>
                        <p className="text-xs font-semibold text-[var(--color-text-primary)] mb-0.5">No Drive folder linked</p>
                        <p className="text-[11px] text-[var(--color-text-tertiary)] mb-4 max-w-xs leading-relaxed">
                          Choose a Google Drive folder as the primary workspace storage to automatically organize deal documents.
                        </p>
                        <Button onClick={() => setShowFolderPicker(true)} disabled={setWorkingFolderMutation.isPending} size="sm" style={{ background: 'var(--accent)', color: 'var(--color-text-inverse)' }} className="h-8 shadow-xs">
                          {setWorkingFolderMutation.isPending ? <LoadingSpinner size="sm" /> : <Folder size={12} className="mr-1" />}
                          Select Root Folder
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          <DriveFolderPicker
            open={showFolderPicker}
            onOpenChange={setShowFolderPicker}
            projectId={projectId}
            onSelect={setWorkingFolderHandler}
          />
        </div>

        {/* Section 3: Sponsors & Access */}
        <div 
          className="animate-item-entrance rounded-xl border p-6" 
          style={{ 
            background: 'var(--color-surface-0)', 
            borderColor: 'var(--color-surface-2)', 
            boxShadow: 'var(--shadow-sm)',
            animationDelay: '150ms'
          }}
        >
          <div className="flex items-center gap-2.5 pb-3 mb-5 border-b border-[var(--color-surface-2)]">
            <div className="p-1.5 rounded-lg bg-[var(--color-accent-bg)] text-[var(--accent)]">
              <Users size={16} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Sponsors & Project Access</h2>
              <p className="text-[11px] text-[var(--color-text-secondary)]">Manage third-party investor and sponsor read-only permissions.</p>
            </div>
          </div>

          {/* Add Sponsor Form Box */}
          <div className="border border-[var(--color-surface-2)] rounded-xl p-4 bg-[var(--color-canvas)] mb-6 shadow-2xs">
            <h3 className="text-xs font-semibold mb-3 text-[var(--color-text-primary)]">Invite New Sponsor</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-text-tertiary)] pl-0.5">Email Address</label>
                <Input
                  value={sponsorEmail}
                  onChange={(e) => setSponsorEmail(e.target.value)}
                  placeholder="email@example.com"
                  type="email"
                  className="bg-[var(--color-surface-0)] border-[var(--color-surface-2)] focus:ring-[var(--accent)] text-xs h-9"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-text-tertiary)] pl-0.5">Full Name</label>
                <Input
                  value={sponsorName}
                  onChange={(e) => setSponsorName(e.target.value)}
                  placeholder="Name (optional)"
                  className="bg-[var(--color-surface-0)] border-[var(--color-surface-2)] focus:ring-[var(--accent)] text-xs h-9"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={addSponsor}
                disabled={addSponsorMutation.isPending || !sponsorEmail}
                size="sm"
                style={{ background: 'var(--accent)', color: 'var(--color-text-inverse)' }}
                className="h-8 px-4"
              >
                {addSponsorMutation.isPending ? <LoadingSpinner size="sm" /> : <Plus size={14} className="mr-1" />}
                Send Invite
              </Button>
            </div>
          </div>

          {/* Sponsors Grid List */}
          <div>
            <h3 className="text-xs font-semibold mb-3 text-[var(--color-text-secondary)]">Active Sponsors ({sponsors.length})</h3>
            {sponsors.length === 0 ? (
              <div className="text-center py-8 border border-dashed rounded-xl border-[var(--color-surface-3)] bg-[var(--color-canvas)] text-[var(--color-text-tertiary)] text-xs leading-relaxed">
                No sponsors invited yet. Invite sponsors above to grant access.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {sponsors.map((s) => {
                  const initials = (s.full_name ?? s.email ?? 'U').charAt(0).toUpperCase()
                  return (
                    <div key={s.id} className="flex items-center justify-between p-3.5 rounded-xl border border-[var(--color-surface-2)] bg-[var(--color-canvas)] hover:border-[var(--accent)] hover:shadow-xs transition-all duration-300 group">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-[var(--color-accent-bg)] text-[var(--accent)] font-semibold text-xs flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-105 border border-[var(--color-accent-light)]">
                          {initials}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-semibold text-[var(--color-text-primary)] truncate">{s.full_name ?? 'Unnamed Sponsor'}</span>
                          <span className="text-[10px] text-[var(--color-text-tertiary)] truncate font-mono">{s.email ?? '—'}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setRemovingSponsor(s)}
                        className="p-1.5 rounded-md hover:bg-[var(--color-surface-2)] text-[var(--color-text-tertiary)] hover:text-[var(--color-danger-text)] transition-colors duration-200 flex-shrink-0 cursor-pointer"
                        title="Remove Access"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <RemoveSponsorDialog
            open={removingSponsor !== null}
            onOpenChange={(open) => { if (!open) setRemovingSponsor(null) }}
            sponsorName={removingSponsor?.full_name ?? null}
            sponsorEmail={removingSponsor?.email ?? null}
            onConfirm={async () => {
              if (!removingSponsor) return
              await removeSponsor(removingSponsor.id)
            }}
          />
        </div>

        {/* Section 4: Advanced Settings */}
        <div 
          className="animate-item-entrance rounded-xl border p-6 border-[var(--color-danger-border)]" 
          style={{ 
            background: 'var(--color-surface-0)', 
            boxShadow: 'var(--shadow-sm)',
            animationDelay: '225ms'
          }}
        >
          <div className="flex items-center gap-2.5 pb-3 mb-5 border-b border-[var(--color-danger-border)]">
            <div className="p-1.5 rounded-lg bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]">
              <AlertTriangle size={16} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-danger-text)]">Advanced Settings</h2>
              <p className="text-[11px] text-[var(--color-danger-text)]/70">Sensitive actions. Proceed with caution.</p>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-danger-border)] p-4 bg-[var(--color-danger-bg)]/10 mb-6 flex gap-3 items-start">
            <ShieldAlert size={18} className="text-[var(--color-danger-text)] flex-shrink-0 mt-0.5" />
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-[var(--color-danger-text)]">Delete Project & Pipeline</span>
              <p className="text-[11px] leading-relaxed text-[var(--color-danger-text)]">
                Deleting this project removes all deal data, campaign tracking, portfolios, and underwriting schemas. Sponsor invite codes will be invalidated. <strong>This action is permanent and cannot be undone.</strong>
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-[var(--color-text-secondary)] mb-1.5">
                Type <code className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]">DELETE</code> to confirm:
              </label>
              <Input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                className="max-w-[240px] w-full font-mono bg-[var(--color-canvas)] border-[var(--color-surface-2)] focus:ring-[var(--color-danger-text)] focus:border-[var(--color-danger-text)] text-xs h-9"
                placeholder="DELETE"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={deleteProject}
                disabled={deleteConfirm !== 'DELETE' || deleteMutation.isPending}
                className="h-9 px-4 text-xs font-medium"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Confirm Delete Project'}
              </Button>
              {deleteConfirm && (
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirm('')}
                  className="h-9 px-4 text-xs border-[var(--color-surface-3)] bg-[var(--color-surface-0)] text-[var(--color-text-secondary)]"
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
