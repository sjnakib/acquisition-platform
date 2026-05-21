'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/shared/PageHeader'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { pageHeadings } from '@/lib/page-headings'
import { Trash2, Plus, X, Save } from 'lucide-react'

interface Sponsor {
  id: string
  user_id: string
  email: string | null
  full_name: string | null
  created_at: string
}

export default function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params)
  const router = useRouter()
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
  const [error, setError] = useState('')

  // Delete state
  const [showDelete, setShowDelete] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('gmail') === 'connected') setGmailConnected(true)
  }, [])

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${projectId}`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/sponsors`).then((r) => r.json()),
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
    setError('')
    const res = await fetch(`/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    })
    if (!res.ok) {
      const json = await res.json()
      setError(json.error ?? 'Failed to save')
    }
    setSaving(false)
  }

  async function addSponsor() {
    if (!sponsorEmail) return
    setAddingSponsor(true)
    setError('')
    const res = await fetch(`/api/projects/${projectId}/sponsors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: sponsorEmail, full_name: sponsorName || undefined }),
    })
    if (!res.ok) {
      const json = await res.json()
      setError(json.error ?? 'Failed to add sponsor')
    } else {
      setSponsorEmail('')
      setSponsorName('')
      // Refresh sponsors list
      const data = await fetch(`/api/projects/${projectId}/sponsors`).then((r) => r.json())
      setSponsors(data ?? [])
    }
    setAddingSponsor(false)
  }

  async function removeSponsor(sponsorId: string) {
    const res = await fetch(`/api/projects/${projectId}/sponsors?sponsorId=${sponsorId}`, { method: 'DELETE' })
    if (res.ok) {
      setSponsors((prev) => prev.filter((s) => s.id !== sponsorId))
    }
  }

  async function deleteProject() {
    if (deleteConfirm !== 'DELETE') return
    setDeleting(true)
    const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/projects')
    } else {
      const json = await res.json()
      setError(json.error ?? 'Failed to delete project')
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Settings" description={pageHeadings.settings.description} />
        <div className="flex items-center justify-center py-20"><LoadingSpinner size="lg" /></div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Settings" description={pageHeadings.settings.description} />

      {error && (
        <div className="mb-4 rounded-md p-3 text-sm" style={{ background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)', color: 'var(--color-danger-text)' }}>
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* General */}
        <div className="rounded-xl border p-6" style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-surface-2)', boxShadow: 'var(--shadow-xs)' }}>
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans)' }}>General</h2>
          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Project Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
                style={{ background: 'var(--color-surface-1)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-md border px-3 py-2 text-sm resize-none"
                style={{ background: 'var(--color-surface-1)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              />
            </div>
            <button
              onClick={saveProject}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white"
              style={{ background: 'var(--accent)' }}
            >
              <Save size={14} />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Sponsors */}
        <div className="rounded-xl border p-6" style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-surface-2)', boxShadow: 'var(--shadow-xs)' }}>
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans)' }}>Sponsors</h2>

          {sponsors.length > 0 && (
            <div className="mb-4 border rounded-md overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
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
                          onClick={() => removeSponsor(s.id)}
                          className="p-1 rounded hover:bg-opacity-10"
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

          <div className="flex gap-2 max-w-md">
            <input
              value={sponsorEmail}
              onChange={(e) => setSponsorEmail(e.target.value)}
              placeholder="email@example.com"
              type="email"
              className="flex-1 rounded-md border px-3 py-2 text-sm"
              style={{ background: 'var(--color-surface-1)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
            />
            <input
              value={sponsorName}
              onChange={(e) => setSponsorName(e.target.value)}
              placeholder="Full name (optional)"
              className="flex-1 rounded-md border px-3 py-2 text-sm"
              style={{ background: 'var(--color-surface-1)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
            />
            <button
              onClick={addSponsor}
              disabled={addingSponsor || !sponsorEmail}
              className="inline-flex items-center gap-1 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              style={{ background: 'var(--accent)' }}
            >
              <Plus size={14} />
              Add
            </button>
          </div>
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
              <a
                href="/api/auth/google"
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-150 active:scale-[0.98] h-[34px] px-[14px] text-[13px]"
                style={{ background: 'var(--accent)', color: '#FFFFFF' }}
              >
                Connect Gmail
              </a>
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
            <button
              onClick={() => setShowDelete(true)}
              className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white"
              style={{ background: 'var(--color-danger)' }}
            >
              <Trash2 size={14} />
              Delete Project
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                Type <code className="px-1.5 py-0.5 rounded text-xs font-bold" style={{ background: 'var(--color-danger-bg)' }}>DELETE</code> to confirm:
              </p>
              <input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                className="w-full max-w-[200px] rounded-md border px-3 py-2 text-sm font-mono"
                style={{ background: 'var(--color-surface-1)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                placeholder="DELETE"
              />
              <div className="flex gap-2">
                <button
                  onClick={deleteProject}
                  disabled={deleteConfirm !== 'DELETE' || deleting}
                  className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: 'var(--color-danger)' }}
                >
                  {deleting ? 'Deleting...' : 'Confirm Delete'}
                </button>
                <button
                  onClick={() => { setShowDelete(false); setDeleteConfirm('') }}
                  className="rounded-md px-4 py-2 text-sm font-medium"
                  style={{ background: 'var(--color-surface-1)', color: 'var(--color-text-secondary)' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
