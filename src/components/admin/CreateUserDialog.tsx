'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { UserRole } from '@/types/database'

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'internal', label: 'Internal' },
  { value: 'client', label: 'Sponsor' },
  { value: 'admin', label: 'Admin' },
]

interface CreateUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

export function CreateUserDialog({ open, onOpenChange, onCreated }: CreateUserDialogProps) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('internal')
  const [clientOrg, setClientOrg] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          full_name: fullName,
          role,
          ...(role === 'client' && clientOrg ? { client_org: clientOrg } : {}),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to create user')
      }

      onCreated()
      onOpenChange(false)
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setFullName('')
    setEmail('')
    setRole('internal')
    setClientOrg('')
    setError(null)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!loading) { onOpenChange(v); if (!v) resetForm() } }}>
      <DialogContent style={{ maxWidth: 440 }}>
        <DialogHeader>
          <DialogTitle>Create User</DialogTitle>
          <DialogDescription>
            Send an email invitation to create a new account.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <Label className="text-[11px] uppercase tracking-[0.08em] block mb-1.5 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
              Full Name
            </Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Smith"
              required
              disabled={loading}
            />
          </div>

          <div>
            <Label className="text-[11px] uppercase tracking-[0.08em] block mb-1.5 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
              Email
            </Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
              required
              disabled={loading}
            />
          </div>

          <div>
            <Label className="text-[11px] uppercase tracking-[0.08em] block mb-1.5 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
              Role
            </Label>
            <div className="flex gap-2">
              {ROLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRole(opt.value)}
                  disabled={loading}
                  className="px-3 py-1.5 rounded-md text-xs font-medium border transition-all duration-150"
                  style={{
                    background: role === opt.value ? 'var(--color-accent-bg, #eef2ff)' : 'transparent',
                    borderColor: role === opt.value ? 'var(--accent)' : 'var(--color-border-primary)',
                    color: role === opt.value ? 'var(--accent)' : 'var(--color-text-secondary)',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {role === 'client' && (
            <div>
              <Label className="text-[11px] uppercase tracking-[0.08em] block mb-1.5 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                Organization (optional)
              </Label>
              <Input
                value={clientOrg}
                onChange={(e) => setClientOrg(e.target.value)}
                placeholder="Acme Capital"
                disabled={loading}
              />
            </div>
          )}

          {error && (
            <div className="text-[13px] rounded-lg p-3 font-medium" style={{ background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)', color: 'var(--color-danger-text)' }}>
              {error}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !email || !fullName}>
              {loading ? <><LoadingSpinner size="sm" /> Sending...</> : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
