'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { UserRole } from '@/types/database'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'internal', label: 'Internal' },
  { value: 'client', label: 'Sponsor' },
  { value: 'admin', label: 'Admin' },
]

const EXPIRY_OPTIONS = [
  { value: 24, label: '24 hours' },
  { value: 48, label: '48 hours' },
  { value: 72, label: '3 days' },
  { value: 168, label: '7 days' },
]

interface CreateUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
  projects: Array<{ id: string; name: string }>
}

export function CreateUserDialog({
  open,
  onOpenChange,
  onCreated,
  projects = [],
}: CreateUserDialogProps) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('internal')
  const [expiresInHours, setExpiresInHours] = useState(48)
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdLink, setCreatedLink] = useState<string | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)

  function toggleProject(id: string) {
    setSelectedProjectIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setCreatedLink(null)

    try {
      const res = await fetch('/api/admin/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          role,
          expiresInHours,
          projectIds: selectedProjectIds,
          ...(message.trim() ? { message: message.trim() } : {}),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to send invitation')
      }

      onCreated()
      setCreatedLink(data.invitation.acceptUrl)

      if (!data.emailSent) {
        toast.warning('Invitation created but email could not be sent.', {
          description: data.emailError ?? 'Copy the link below to share manually.',
        })
      } else {
        toast.success(`Invitation sent to ${email}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setEmail('')
    setRole('internal')
    setExpiresInHours(48)
    setSelectedProjectIds([])
    setMessage('')
    setError(null)
    setCreatedLink(null)
    setLinkCopied(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!loading) {
          onOpenChange(v)
          if (!v) resetForm()
        }
      }}
    >
      <DialogContent style={{ maxWidth: 460 }}>
        <DialogHeader>
          <DialogTitle>Invite User</DialogTitle>
          <DialogDescription>
            Send an invitation. The recipient will set their own name and
            password.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Email */}
          <div>
            <Label
              className="text-[11px] uppercase tracking-[0.08em] block mb-1.5 font-semibold"
              style={{ color: 'var(--color-text-secondary)' }}
            >
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

          {/* Role */}
          <div>
            <Label
              className="text-[11px] uppercase tracking-[0.08em] block mb-1.5 font-semibold"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Account Type
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
                    background:
                      role === opt.value
                        ? 'var(--color-accent-bg, #eef2ff)'
                        : 'transparent',
                    borderColor:
                      role === opt.value
                        ? 'var(--accent)'
                        : 'var(--color-border-primary)',
                    color:
                      role === opt.value
                        ? 'var(--accent)'
                        : 'var(--color-text-secondary)',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Expiry */}
          <div>
            <Label
              className="text-[11px] uppercase tracking-[0.08em] block mb-1.5 font-semibold"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Link Expires In
            </Label>
            <div className="flex gap-2 flex-wrap">
              {EXPIRY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setExpiresInHours(opt.value)}
                  disabled={loading}
                  className="px-3 py-1.5 rounded-md text-xs font-medium border transition-all duration-150"
                  style={{
                    background:
                      expiresInHours === opt.value
                        ? 'var(--color-accent-bg, #eef2ff)'
                        : 'transparent',
                    borderColor:
                      expiresInHours === opt.value
                        ? 'var(--accent)'
                        : 'var(--color-border-primary)',
                    color:
                      expiresInHours === opt.value
                        ? 'var(--accent)'
                        : 'var(--color-text-secondary)',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Project assignment */}
          {projects.length > 0 && (
            <div>
              <Label
                className="text-[11px] uppercase tracking-[0.08em] block mb-1.5 font-semibold"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Project Access (optional)
              </Label>
              <div
                className="max-h-32 overflow-y-auto rounded-lg border p-2 space-y-0.5"
                style={{ borderColor: 'var(--color-surface-2)' }}
              >
                {projects.map(
                  (p: { id: string; name: string }) => (
                    <label
                      key={p.id}
                      htmlFor={`project-${p.id}`}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-[var(--color-surface-1)] transition-colors duration-150"
                    >
                      <Checkbox
                        id={`project-${p.id}`}
                        checked={selectedProjectIds.includes(p.id)}
                        onCheckedChange={() => toggleProject(p.id)}
                        disabled={loading}
                      />
                      <span
                        className="text-xs select-none"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        {p.name}
                      </span>
                    </label>
                  ),
                )}
              </div>
            </div>
          )}

          {/* Optional message */}
          <div>
            <Label
              className="text-[11px] uppercase tracking-[0.08em] block mb-1.5 font-semibold"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Personal Message (optional)
            </Label>
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a note to the invitation email..."
              disabled={loading}
            />
          </div>

          {/* Error */}
          {error && (
            <div
              className="text-[13px] rounded-lg p-3 font-medium"
              style={{
                background: 'var(--color-danger-bg)',
                border: '1px solid var(--color-danger-border)',
                color: 'var(--color-danger-text)',
              }}
            >
              {error}
            </div>
          )}

          {/* Created invitation link */}
          {createdLink && (
            <div
              className="rounded-lg p-3 space-y-2 animate-item-entrance"
              style={{
                background: 'var(--color-accent-bg)',
                border: '1px solid var(--color-accent-light)',
              }}
            >
              <p
                className="text-[11px] uppercase tracking-[0.08em] font-semibold"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Invitation Link
              </p>
              <div className="flex items-center gap-2">
                <code
                  className="flex-1 text-[12px] px-2 py-1.5 rounded break-all"
                  style={{
                    background: 'var(--color-surface-0)',
                    color: 'var(--accent)',
                    border: '1px solid var(--color-surface-2)',
                  }}
                >
                  {createdLink}
                </code>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(createdLink)
                    setLinkCopied(true)
                    setTimeout(() => setLinkCopied(false), 2000)
                  }}
                  className="flex-shrink-0 h-8"
                >
                  {linkCopied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
              <p
                className="text-[11px]"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                Share this link with the invitee. They will set their own name
                and password.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !email}>
              {loading ? (
                <>
                  <LoadingSpinner size="sm" /> Sending...
                </>
              ) : (
                'Send Invitation'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
