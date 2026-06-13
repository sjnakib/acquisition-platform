'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { pageHeadings } from '@/lib/page-headings'
import { 
  Save, X, PencilLine, Shield, KeyRound, Calendar, 
  Mail, Building2, CheckCircle2 
} from 'lucide-react'
import { toast } from 'sonner'

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

const PRESET_GRADIENTS = [
  { id: 'emerald', name: 'Emerald Glow', style: 'linear-gradient(135deg, #1E5B3F 0%, #0F2E20 100%)' },
  { id: 'aurora', name: 'Midnight Aurora', style: 'linear-gradient(135deg, #0284c7 0%, #1e1b4b 100%)' },
  { id: 'sunset', name: 'Sunset Bronze', style: 'linear-gradient(135deg, #d97706 0%, #451a03 100%)' },
  { id: 'ocean', name: 'Ocean Glass', style: 'linear-gradient(135deg, #0d9488 0%, #115e59 100%)' },
  { id: 'orchid', name: 'Cyber Orchid', style: 'linear-gradient(135deg, #c084fc 0%, #581c87 100%)' },
  { id: 'gold', name: 'Solar Gold', style: 'linear-gradient(135deg, #eab308 0%, #713f12 100%)' }
]

const TABS = [
  { key: 'profile', label: 'Profile Details' },
  { key: 'system', label: 'System Details' }
]

function ProfileContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editAvatarUrl, setEditAvatarUrl] = useState('')
  const activeTab = searchParams.get('tab') ?? 'profile'
  const setActiveTab = useCallback((tab: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [searchParams, router, pathname])

  const { data, isLoading: loading, error: queryError } = useQuery<ProfileData>({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const res = await fetch('/api/auth/me')
      if (res.status === 401) {
        queryClient.clear()
        router.push('/login')
        throw new Error('Unauthorized')
      }
      if (!res.ok) throw new Error('Failed to load profile')
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      return json
    },
  })

  const [prevData, setPrevData] = useState<typeof data | null>(null)
  if (data !== prevData) {
    setPrevData(data)
    if (data) {
      setEditName(data.profile?.full_name ?? '')
      setEditAvatarUrl(data.profile?.avatar_url ?? '')
    }
  }

  const error = queryError ? (queryError instanceof Error ? queryError.message : 'Failed to load profile') : ''

  const updateProfile = useMutation({
    mutationFn: async (payload: { full_name: string; avatar_url: string | null }) => {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Failed to save changes')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
      setEditing(false)
      toast.success('Profile updated successfully')
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'Failed to save profile'
      toast.error(msg)
    },
  })

  async function handleSave() {
    if (!editName.trim()) {
      toast.error('Name cannot be empty')
      return
    }
    updateProfile.mutate({
      full_name: editName.trim(),
      avatar_url: editAvatarUrl.trim() || null,
    })
  }

  function handleCancel() {
    setEditName(data?.profile?.full_name ?? '')
    setEditAvatarUrl(data?.profile?.avatar_url ?? '')
    setEditing(false)
  }

  if (loading) {
    return (
      <div className="w-full">
        <PageHeader title={pageHeadings.profile.title} description={pageHeadings.profile.description} />
        <div className="flex items-center justify-center py-20"><LoadingSpinner size="lg" /></div>
      </div>
    )
  }

  const roleLabel = data?.profile?.role === 'client' ? 'Sponsor' : data?.profile?.role === 'admin' ? 'Admin' : (data?.profile?.role ?? 'Team')
  const avatarUrl = data?.profile?.avatar_url
  const avatarInitial = (data?.profile?.full_name ?? data?.user?.email ?? 'U').charAt(0).toUpperCase()

  return (
    <div className="space-y-6 pb-12 w-full">
      {/* Standard page header aligned exactly like other workspace pages */}
      <PageHeader title={pageHeadings.profile.title} description={pageHeadings.profile.description} />

      {error && (
        <div className="rounded-md p-3 text-sm font-medium flex items-center gap-2 border mb-4 max-w-2xl mx-auto w-full" style={{ background: 'var(--color-danger-bg)', borderColor: 'var(--color-danger-border)', color: 'var(--color-danger-text)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-danger-text)]" />
          {error}
        </div>
      )}

      {/* Centered Profile Card container (Centered like LinkedIn) */}
      <div className="space-y-6 max-w-2xl mx-auto w-full">
        
        {/* Profile Header Card */}
        <div className="flex flex-col items-center justify-center text-center pb-6 border-b" style={{ borderColor: 'var(--color-surface-2)' }}>
          <div 
            className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-semibold select-none relative overflow-hidden shadow-sm border mb-3"
            style={{ 
              borderColor: 'var(--color-surface-3)',
              background: avatarUrl 
                ? avatarUrl.startsWith('linear-gradient')
                  ? avatarUrl
                  : 'transparent'
                : 'var(--color-accent-bg)',
              color: avatarUrl && !avatarUrl.startsWith('linear-gradient') ? 'transparent' : 'var(--color-text-inverse)'
            }}
          >
            {avatarUrl && !avatarUrl.startsWith('linear-gradient') ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img 
                src={avatarUrl} 
                alt="Avatar" 
                className="w-full h-full object-cover rounded-full" 
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
            ) : null}
            {(!avatarUrl || avatarUrl.startsWith('linear-gradient')) && (
              <span style={{ color: 'var(--color-accent)' }}>{avatarInitial}</span>
            )}
          </div>
          
          <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans)' }}>
            {data?.profile?.full_name ?? '—'}
          </h1>
          
          <div className="flex items-center gap-2 mb-4 justify-center">
            <span className="text-[11px] font-medium tracking-[0.03em] uppercase" style={{ color: 'var(--color-text-tertiary)' }}>
              {roleLabel}
            </span>
          </div>

          <div className="flex items-center justify-center gap-2">
            {!editing ? (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setEditing(true)} 
              >
                <PencilLine size={13} />
                Edit Profile
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleCancel} 
                  disabled={updateProfile.isPending}
                >
                  <X size={13} />
                  Cancel
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleSave} 
                  disabled={updateProfile.isPending || !editName.trim()}
                  className="bg-[var(--color-accent)] border-none text-[var(--color-text-inverse)] hover:bg-[var(--color-accent)]/90"
                >
                  <Save size={13} />
                  {updateProfile.isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Centered Tab Navigation */}
        <div className="border-b" style={{ borderColor: 'var(--color-surface-2)' }}>
          <nav className="flex justify-center gap-6">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key ? 'border-current' : 'border-transparent'
                }`}
                style={{
                  color: activeTab === tab.key ? 'var(--accent)' : 'var(--color-text-tertiary)',
                }}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Main Tabbed Content Card */}
        <div 
          className="rounded-xl border p-6 transition-all duration-300" 
          style={{ 
            background: 'var(--color-surface-0)', 
            borderColor: 'var(--color-border)' 
          }}
        >
          <div className="max-w-xl mx-auto w-full">
            {activeTab === 'profile' && (
              <div className="space-y-6">
                {editing ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-5">
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Full Name</label>
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="bg-[var(--color-surface-1)] border-[var(--color-surface-3)] focus:border-[var(--color-accent)] w-full"
                          placeholder="E.g. Shafaat Nakib"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Avatar Image URL</label>
                        <div className="flex gap-2">
                          <Input
                            value={editAvatarUrl.startsWith('linear-gradient') ? '' : editAvatarUrl}
                            onChange={(e) => setEditAvatarUrl(e.target.value)}
                            className="bg-[var(--color-surface-1)] border-[var(--color-surface-3)] focus:border-[var(--color-accent)] flex-1 text-[13px]"
                            placeholder="https://images.unsplash.com/... (optional)"
                            disabled={editAvatarUrl.startsWith('linear-gradient')}
                          />
                          {editAvatarUrl.startsWith('linear-gradient') && (
                            <Button variant="outline" size="sm" onClick={() => setEditAvatarUrl('')}>Clear Preset</Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Preset gradients builder */}
                    <div className="space-y-3 pt-2">
                      <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Choose Preset Gradient Avatar</label>
                      <div className="flex flex-wrap gap-3 justify-center">
                        {PRESET_GRADIENTS.map((preset) => {
                          const isActive = editAvatarUrl === preset.style
                          return (
                            <button
                              key={preset.id}
                              onClick={() => setEditAvatarUrl(preset.style)}
                              type="button"
                              className="w-10 h-10 rounded-full border-2 transition-all duration-200 transform hover:scale-105 active:scale-95 flex items-center justify-center cursor-pointer shadow-sm"
                              style={{
                                background: preset.style,
                                borderColor: isActive ? 'var(--color-accent)' : 'transparent',
                                boxShadow: isActive ? '0 0 8px var(--color-accent)' : 'none'
                              }}
                              title={preset.name}
                            >
                              {isActive && <CheckCircle2 className="w-4 h-4 text-white drop-shadow-md" />}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-y-5 text-sm">
                      <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: 'var(--color-surface-2)' }}>
                        <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>Full Name</span>
                        <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{data?.profile?.full_name ?? '—'}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: 'var(--color-surface-2)' }}>
                        <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>Email Address</span>
                        <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{data?.user?.email ?? '—'}</span>
                      </div>
                      {data?.profile?.client_org && (
                        <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: 'var(--color-surface-2)' }}>
                          <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>Organization</span>
                          <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{data.profile.client_org}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: 'var(--color-surface-2)' }}>
                        <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>Active Avatar Style</span>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-7 h-7 rounded-full border flex items-center justify-center text-xs font-semibold"
                            style={{ 
                              borderColor: 'var(--color-surface-3)',
                              background: avatarUrl 
                                ? avatarUrl.startsWith('linear-gradient')
                                  ? avatarUrl
                                  : 'transparent'
                                : 'var(--color-accent-bg)',
                              color: avatarUrl && !avatarUrl.startsWith('linear-gradient') ? 'transparent' : 'var(--color-text-inverse)'
                            }}
                          >
                            {avatarUrl && !avatarUrl.startsWith('linear-gradient') ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img 
                                src={avatarUrl} 
                                alt="Avatar" 
                                className="w-full h-full object-cover rounded-full" 
                                onError={(e) => { e.currentTarget.style.display = 'none' }}
                              />
                            ) : null}
                            {(!avatarUrl || avatarUrl.startsWith('linear-gradient')) && (
                              <span style={{ color: 'var(--color-accent)', fontSize: '10px' }}>{avatarInitial}</span>
                            )}
                          </div>
                          <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                            {avatarUrl 
                              ? avatarUrl.startsWith('linear-gradient') 
                                ? PRESET_GRADIENTS.find(p => p.style === avatarUrl)?.name ?? 'Preset Gradient'
                                : 'Custom Image URL'
                              : 'Default Initial Avatar'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'system' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-y-5 text-sm">
                  <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: 'var(--color-surface-2)' }}>
                    <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>Account Created</span>
                    <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      {data?.profile?.created_at
                        ? new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(data.profile.created_at))
                        : '—'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: 'var(--color-surface-2)' }}>
                    <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>Access Role</span>
                    <span className="text-xs font-medium tracking-[0.03em] uppercase" style={{ color: 'var(--color-text-primary)' }}>
                      {roleLabel}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<LoadingSpinner size="lg" />}>
      <ProfileContent />
    </Suspense>
  )
}
