'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/shared/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { pageHeadings } from '@/lib/page-headings'
import { Save, X, PencilLine } from 'lucide-react'

interface ProfileData {
  user: { id: string; email: string | null }
  profile: {
    full_name: string | null
    role: string | null
    client_org: string | null
    avatar_url: string | null
    created_at: string | null
  }
}

export default function ProfilePage() {
  const router = useRouter()
  const [data, setData] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => {
        if (r.status === 401) { router.push('/login'); return null }
        return r.json()
      })
      .then((json) => {
        if (!json) return
        if (json.error) { setError(json.error); return }
        setData(json)
        setEditName(json.profile?.full_name ?? '')
      })
      .catch(() => setError('Failed to load profile'))
      .finally(() => setLoading(false))
  }, [router])

  async function handleSave() {
    if (!editName.trim()) return
    setSaving(true)
    setError('')
    const res = await fetch('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: editName.trim() }),
    })
    if (!res.ok) {
      const json = await res.json()
      setError(json.error ?? 'Failed to save')
    } else {
      setData((prev) => prev ? { ...prev, profile: { ...prev.profile, full_name: editName.trim() } } : prev)
      setEditing(false)
    }
    setSaving(false)
  }

  function handleCancel() {
    setEditName(data?.profile?.full_name ?? '')
    setEditing(false)
  }

  if (loading) {
    return (
      <div>
        <PageHeader title={pageHeadings.profile.title} description={pageHeadings.profile.description} />
        <div className="flex items-center justify-center py-20"><LoadingSpinner size="lg" /></div>
      </div>
    )
  }

  const avatarInitial = (data?.profile?.full_name ?? data?.user?.email ?? 'U').charAt(0).toUpperCase()
  const isInternal = data?.profile?.role === 'internal'

  return (
    <div>
      <PageHeader title={pageHeadings.profile.title} description={pageHeadings.profile.description} />

      {error && (
        <div className="mb-4 rounded-md p-3 text-sm" style={{ background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)', color: 'var(--color-danger-text)' }}>
          {error}
        </div>
      )}

      <div className="space-y-6 max-w-2xl">
        {/* Profile card */}
        <div className="rounded-xl border p-6" style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-surface-2)', boxShadow: 'var(--shadow-xs)' }}>
          <div className="flex items-start justify-between mb-6">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans)' }}>Profile</h2>
            {isInternal && !editing && (
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                <PencilLine size={14} />
                Edit
              </Button>
            )}
            {isInternal && editing && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCancel} disabled={saving}>
                  <X size={14} />
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving || !editName.trim()}>
                  <Save size={14} />
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-5 mb-6">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-semibold flex-shrink-0"
              style={{ background: 'var(--color-accent-bg)', color: 'var(--color-accent-muted)' }}
            >
              {avatarInitial}
            </div>
            <div>
              {isInternal && editing ? (
                <div className="space-y-2">
                  <label className="block text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Full Name</label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="bg-[var(--color-surface-1)]"
                    placeholder="Your name"
                  />
                </div>
              ) : (
                <>
                  <div className="text-base font-medium" style={{ color: 'var(--color-text-primary)' }}>{data?.profile?.full_name ?? '—'}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={isInternal ? 'accent' : 'info'} size="sm">
                      {data?.profile?.role ?? '—'}
                    </Badge>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Email</div>
              <div className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{data?.user?.email ?? '—'}</div>
            </div>
            {data?.profile?.client_org && (
              <div>
                <div className="text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Organization</div>
                <div className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{data.profile.client_org}</div>
              </div>
            )}
          </div>
        </div>

        {/* Account card — internal only */}
        {isInternal && (
          <div className="rounded-xl border p-6" style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-surface-2)', boxShadow: 'var(--shadow-xs)' }}>
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans)' }}>Account</h2>
            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Member Since</div>
                <div className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                  {data?.profile?.created_at
                    ? new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(data.profile.created_at))
                    : '—'}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>User ID</div>
                <div className="text-xs font-mono" style={{ color: 'var(--color-text-tertiary)' }}>{data?.user?.id ?? '—'}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
