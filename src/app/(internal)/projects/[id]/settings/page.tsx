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
import { Trash2, Plus, X, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
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
  const supabase = createClient()
  const [project, setProject] = useState<{ name: string; description: string | null } | null>(null)
  const [sponsors, setSponsors] = useState<Sponsor[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [gmailConnected, setGmailConnected] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [sponsorEmail, setSponsorEmail] = useState('')
  const [sponsorName, setSponsorName] = useState('')
  const [addingSponsor, setAddingSponsor] = useState(false)

  // Delete state
  const [showDelete, setShowDelete] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Remove sponsor dialog
  const [removingSponsor, setRemovingSponsor] = useState<Sponsor | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('gmail') === 'connected') {
      setGmailConnected(true)
    } else {
      supabase
        .from('google_tokens')
        .select('user_id')
        .then(({ data }) => {
          if (data && data.length > 0) {
            setGmailConnected(true)
          }
        })
    }
  }, [supabase])

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
      })
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

      <div className="space-y-6 max-w-2xl mx-auto w-full">
        {/* General */}
        <div className="rounded-xl border p-6" style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-surface-2)', boxShadow: 'var(--shadow-xs)' }}>
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans)' }}>General</h2>
          <div className="space-y-4 w-full">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Project Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-[var(--color-surface-1)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="bg-[var(--color-surface-1)] resize-none"
              />
            </div>
            <Button onClick={saveProject} disabled={saving}>
              <Save size={14} />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>

        {/* Sponsors */}
        <div className="rounded-xl border p-6" style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-surface-2)', boxShadow: 'var(--shadow-xs)' }}>
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans)' }}>Sponsors</h2>

          <div className="flex gap-2 w-full mb-4">
            <Input
              value={sponsorEmail}
              onChange={(e) => setSponsorEmail(e.target.value)}
              placeholder="email@example.com"
              type="email"
              className="flex-1 bg-[var(--color-surface-1)]"
            />
            <Input
              value={sponsorName}
              onChange={(e) => setSponsorName(e.target.value)}
              placeholder="Full name (optional)"
              className="flex-1 bg-[var(--color-surface-1)]"
            />
            <Button
              onClick={addSponsor}
              disabled={addingSponsor || !sponsorEmail}
            >
              <Plus size={14} />
              Add
            </Button>
          </div>

          {sponsors.length > 0 && (
            <div className="border rounded-md overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
              <table className="w-full text-sm">
                <thead style={{ background: 'var(--color-surface-1)' }}>
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Name</th>
                    <th className="text-left px-4 py-2 text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Email</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {sponsors.map((s) => (
                    <tr key={s.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                      <td className="px-4 py-2" style={{ color: 'var(--color-text-primary)' }}>{s.full_name ?? '—'}</td>
                      <td className="px-4 py-2" style={{ color: 'var(--color-text-secondary)' }}>{s.email ?? '—'}</td>
                      <td className="px-2 py-2">
                        <button
                          onClick={() => setRemovingSponsor(s)}
                          className="p-1 rounded transition-colors hover:bg-[var(--color-surface-1)]"
                          style={{ color: 'var(--color-text-tertiary)' }}
                        >
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

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

        {/* Gmail */}
        <div className="rounded-xl border p-6" style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-surface-2)', boxShadow: 'var(--shadow-xs)' }}>
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans)' }}>Gmail Connection</h2>
          {gmailConnected ? (
            <Badge variant="success" dot>Gmail Connected</Badge>
          ) : (
            <div className="space-y-3">
              <div className="rounded-md p-3 text-sm" style={{ background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-border)', color: 'var(--color-warning-text)' }}>
                Gmail not connected
              </div>
              <Button asChild>
                <a href="/api/auth/google">Connect Gmail</a>
              </Button>
            </div>
          )}
        </div>

        {/* Danger Zone */}
        <div className="rounded-xl border p-6" style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-danger-border)' }}>
          <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-danger-text)', fontFamily: 'var(--font-dm-sans)' }}>Danger Zone</h2>
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            Deleting a project removes all deals, campaigns, portfolios, and field definitions. This cannot be undone.
          </p>
          {!showDelete ? (
            <Button variant="destructive" onClick={() => setShowDelete(true)}>
              <Trash2 size={14} />
              Delete Project
            </Button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                Type <code className="px-1.5 py-0.5 rounded text-xs font-bold" style={{ background: 'var(--color-danger-bg)' }}>DELETE</code> to confirm:
              </p>
              <Input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                className="max-w-[220px] w-full font-mono bg-[var(--color-surface-1)]"
                placeholder="DELETE"
              />
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  onClick={deleteProject}
                  disabled={deleteConfirm !== 'DELETE' || deleting}
                >
                  {deleting ? 'Deleting...' : 'Confirm Delete'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setShowDelete(false); setDeleteConfirm('') }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
