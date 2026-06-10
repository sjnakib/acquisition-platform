'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
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
import { useQueryClient } from '@tanstack/react-query'
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

  // Project details & Sponsors state
  const [project, setProject] = useState<{ name: string; description: string | null; google_connections: { google_email: string } | null } | null>(null)
  const [sponsors, setSponsors] = useState<Sponsor[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [gmailConnected, setGmailConnected] = useState(false)
  const [gmailEmail, setGmailEmail] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)

  // Drive working folder state
  const [workingFolder, setWorkingFolder] = useState<{ folderId: string; folderUrl: string; name: string } | null>(null)
  const [showFolderPicker, setShowFolderPicker] = useState(false)
  const [settingFolder, setSettingFolder] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [sponsorEmail, setSponsorEmail] = useState('')
  const [sponsorName, setSponsorName] = useState('')
  const [addingSponsor, setAddingSponsor] = useState(false)

  // Delete state
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Remove sponsor dialog
  const [removingSponsor, setRemovingSponsor] = useState<Sponsor | null>(null)

  // Check Gmail connection status from URL param after OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('gmail') === 'connected') {
      const cb = () => setGmailConnected(true)
      if (window.requestIdleCallback) { window.requestIdleCallback(cb) } else { setTimeout(cb, 0) }
      // Clear the query param from URL
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${projectId}`).then(async (r) => {
        if (!r.ok) throw new Error('Failed to load project')
        return r.json()
      }),
      fetch(`/api/projects/${projectId}/sponsors`).then(async (r) => {
        if (!r.ok) throw new Error('Failed to load sponsors')
        return r.json()
      }),
    ])
      .then(([proj, spons]) => {
        setProject(proj)
        setName(proj.name ?? '')
        setDescription(proj.description ?? '')
        setSponsors(spons ?? [])
        if (proj.google_connections?.google_email) {
          setGmailConnected(true)
          setGmailEmail(proj.google_connections.google_email)
        }
      })

    fetch(`/api/projects/${projectId}/drive/working-folder`)
      .then((r) => r.json())
      .then((data) => {
        if (data.workingFolder) {
          setWorkingFolder(data.workingFolder)
        }
      })
      .catch(() => {})
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [projectId])

  async function saveProject() {
    setSaving(true)
    const res = await fetch(`/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    })
    if (!res.ok) {
      const json = await res.json()
      toast.error(json.error ?? 'Failed to save project')
    } else {
      toast.success('Project saved')
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      window.dispatchEvent(new CustomEvent('project-updated', { detail: { name } }))
    }
    setSaving(false)
  }

  async function addSponsor() {
    if (!sponsorEmail) return
    setAddingSponsor(true)
    const res = await fetch(`/api/projects/${projectId}/sponsors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: sponsorEmail, full_name: sponsorName || undefined }),
    })
    if (!res.ok) {
      const json = await res.json()
      toast.error(json.error ?? 'Failed to add sponsor')
    } else {
      toast.success('Sponsor added')
      setSponsorEmail('')
      setSponsorName('')
      const data = await fetch(`/api/projects/${projectId}/sponsors`).then((r) => r.json())
      setSponsors(data ?? [])
    }
    setAddingSponsor(false)
  }

  async function removeSponsor(sponsorId: string) {
    const res = await fetch(`/api/projects/${projectId}/sponsors?sponsorId=${sponsorId}`, { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json()
      throw new Error(json.error ?? 'Failed to remove sponsor')
    }
    setSponsors((prev) => prev.filter((s) => s.id !== sponsorId))
  }

  async function disconnectGmail() {
    setDisconnecting(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/google/disconnect`, { method: 'POST' })
      if (!res.ok) {
        const json = await res.json()
        toast.error(json.error ?? 'Failed to disconnect Gmail')
      } else {
        setGmailConnected(false)
        setGmailEmail(null)
        toast.success('Gmail disconnected')
      }
    } catch {
      toast.error('Failed to disconnect Gmail')
    } finally {
      setDisconnecting(false)
    }
  }

  async function setWorkingFolderHandler(folderId: string) {
    setSettingFolder(true)
    const res = await fetch(`/api/projects/${projectId}/drive/working-folder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderId }),
    })
    if (!res.ok) {
      const json = await res.json()
      setSettingFolder(false)
      throw new Error(json.error ?? `Failed to set working folder (${res.status})`)
    }
    const infoRes = await fetch(`/api/projects/${projectId}/drive/working-folder`)
    const info = await infoRes.json()
    if (info.workingFolder) {
      setWorkingFolder(info.workingFolder)
    }
    setSettingFolder(false)
  }

  async function removeWorkingFolder() {
    try {
      const res = await fetch(`/api/projects/${projectId}/drive/working-folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId: null }),
      })
      if (res.ok) {
        setWorkingFolder(null)
        toast.success('Working folder removed')
      }
    } catch {
      toast.error('Failed to remove working folder')
    }
  }

  async function deleteProject() {
    if (deleteConfirm !== 'DELETE') return
    setDeleting(true)
    const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Project deleted')
      router.push('/projects')
    } else {
      const json = await res.json()
      toast.error(json.error ?? 'Failed to delete project')
      setDeleting(false)
    }
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
              <Button onClick={saveProject} disabled={saving} style={{ background: 'var(--accent)', color: 'var(--color-text-inverse)' }} className="shadow-xs flex items-center gap-1.5 h-9">
                {saving ? <LoadingSpinner size="sm" /> : <Save size={14} />}
                {saving ? 'Saving Changes...' : 'Save Changes'}
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
                    <Button variant="outline" size="sm" onClick={disconnectGmail} disabled={disconnecting} className="h-8 text-xs border-[var(--color-surface-3)] hover:bg-[var(--color-danger-border)] hover:text-[var(--color-danger-text)] bg-[var(--color-surface-0)] transition-colors duration-200">
                      {disconnecting ? <LoadingSpinner size="sm" /> : 'Disconnect Account'}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Branching tree representation */}
              <div className="relative pl-6 ml-9 border-l border-dashed border-[var(--color-surface-3)] space-y-6">
                
                {/* Branch 1: Gmail Service */}
                <div className="relative">
                  {/* Connector Dot */}
                  <span className="absolute -left-[30.5px] top-4.5 w-2 h-2 rounded-full bg-[var(--accent)] border border-[var(--color-surface-0)]" />
                  
                  <div className="p-4 rounded-xl border border-[var(--color-surface-2)] bg-[var(--color-canvas)]">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[var(--color-surface-0)] border border-[var(--color-surface-2)] flex items-center justify-center text-[var(--accent)] shadow-2xs">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
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
                  <span className="absolute -left-[30.5px] top-4.5 w-2 h-2 rounded-full bg-[#0F9D58] border border-[var(--color-surface-0)]" />

                  <div className="p-4 rounded-xl border border-[var(--color-surface-2)] bg-[var(--color-canvas)] space-y-4">
                    <div className="flex items-center justify-between gap-4 pb-3 border-b border-[var(--color-surface-2)]">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[var(--color-surface-0)] border border-[var(--color-surface-2)] flex items-center justify-center text-[#0F9D58] shadow-2xs">
                          <Folder size={15} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-semibold text-[var(--color-text-primary)]">Google Drive workspace storage</span>
                          <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5 leading-relaxed">
                            Organizes checklist items and documents in the project's Drive folder under the same account.
                          </p>
                        </div>
                      </div>
                      {!workingFolder && (
                        <Button onClick={() => setShowFolderPicker(true)} disabled={settingFolder} size="sm" style={{ background: 'var(--accent)', color: 'var(--color-text-inverse)' }} className="h-8 shadow-xs">
                          {settingFolder ? <LoadingSpinner size="sm" /> : <Folder size={12} className="mr-1" />}
                          Set Folder
                        </Button>
                      )}
                    </div>

                    {workingFolder ? (
                      <div className="space-y-4 pt-1">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 rounded-lg border border-[var(--color-surface-2)] bg-[var(--color-surface-0)] shadow-3xs">
                          <div className="flex items-center gap-3 min-w-0">
                            <svg className="w-5 h-5 flex-shrink-0 text-[#0F9D58]" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3z"/>
                            </svg>
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-semibold text-[var(--color-text-primary)] truncate">{workingFolder.name}</span>
                              <a
                                href={workingFolder.folderUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] hover:underline inline-flex items-center gap-1 text-[var(--accent)] font-semibold mt-0.5"
                              >
                                View folder in Google Drive <ExternalLink size={10} />
                              </a>
                            </div>
                          </div>
                          <div className="flex gap-2 self-end sm:self-center">
                            <Button variant="outline" size="sm" onClick={() => setShowFolderPicker(true)} disabled={settingFolder} className="h-7 text-[10px] border-[var(--color-surface-3)] bg-[var(--color-surface-0)] px-2">
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
                              <span className="font-semibold text-[var(--color-text-primary)]">{workingFolder.name}</span>
                              <span className="text-[9px] bg-[var(--color-surface-2)] text-[var(--color-text-tertiary)] px-1.5 py-0.5 rounded font-sans">Root</span>
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
                        <Button onClick={() => setShowFolderPicker(true)} disabled={settingFolder} size="sm" style={{ background: 'var(--accent)', color: 'var(--color-text-inverse)' }} className="h-8 shadow-xs">
                          {settingFolder ? <LoadingSpinner size="sm" /> : <Folder size={12} className="mr-1" />}
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
                disabled={addingSponsor || !sponsorEmail}
                size="sm"
                style={{ background: 'var(--accent)', color: 'var(--color-text-inverse)' }}
                className="h-8 px-4"
              >
                {addingSponsor ? <LoadingSpinner size="sm" /> : <Plus size={14} className="mr-1" />}
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
                disabled={deleteConfirm !== 'DELETE' || deleting}
                className="h-9 px-4 text-xs font-medium"
              >
                {deleting ? 'Deleting...' : 'Confirm Delete Project'}
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
