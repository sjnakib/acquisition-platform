'use client'

import { useState, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Plus, X, ChevronDown, ChevronRight, Mail } from 'lucide-react'
import { toast } from 'sonner'

interface Contact {
  id: string
  email: string[] | null
}

interface ContactsPanelProps {
  dealId: string
  onEmailClick: (email: string, contactId: string) => void
}

export function ContactsPanel({ dealId, onEmailClick }: ContactsPanelProps) {
  const [expanded, setExpanded] = useState(true)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)

  // All unique emails across contacts, flattened
  const allEmails = contacts.flatMap((c) => (c.email ?? []).map((e) => ({ email: e, contactId: c.id })))

  // Add form
  const [showAdd, setShowAdd] = useState(false)
  const [addEmail, setAddEmail] = useState('')
  const [saving, setSaving] = useState(false)

  // Remove confirmation
  const [removing, setRemoving] = useState<{ email: string; contactId: string } | null>(null)

  const fetchContacts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/deals/${dealId}/contacts`)
      if (res.ok) {
        setContacts(await res.json())
      }
    } catch {
      // Silent
    } finally {
      setLoading(false)
    }
  }, [dealId])

  useEffect(() => {
    const id = setTimeout(() => fetchContacts(), 0)
    return () => clearTimeout(id)
  }, [fetchContacts])

  const handleAdd = useCallback(async () => {
    const emails = addEmail
      .split(',')
      .map((e) => e.trim())
      .filter((e) => e.length > 0 && e.includes('@'))

    if (emails.length === 0) {
      toast.error('At least one valid email is required')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deal_id: dealId,
          name: emails[0], // use first email as name (DB requires a name)
          email: emails,
        }),
      })
      if (res.ok) {
        toast.success(emails.length === 1 ? 'Email added' : `${emails.length} emails added`)
        setShowAdd(false)
        setAddEmail('')
        fetchContacts()
      } else {
        const json = await res.json()
        toast.error(json.error ?? 'Failed to add')
      }
    } catch {
      toast.error('Failed to add email')
    } finally {
      setSaving(false)
    }
  }, [addEmail, dealId, fetchContacts])

  const handleRemove = useCallback(async (contactId: string) => {
    try {
      const res = await fetch(`/api/contacts/${contactId}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Email removed')
        fetchContacts()
      } else {
        const json = await res.json()
        toast.error(json.error ?? 'Failed to remove')
      }
    } catch {
      toast.error('Failed to remove')
    } finally {
      setRemoving(null)
    }
  }, [fetchContacts])

  return (
    <div style={{ borderColor: 'var(--color-surface-2)' }}>
      {/* Section header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 border-b hover:bg-[var(--color-surface-1)] transition-colors"
        style={{ borderColor: 'var(--color-surface-2)' }}
      >
        <div className="flex items-center gap-1.5">
          {expanded ? (
            <ChevronDown size={12} style={{ color: 'var(--color-text-tertiary)' }} />
          ) : (
            <ChevronRight size={12} style={{ color: 'var(--color-text-tertiary)' }} />
          )}
          <Mail size={13} style={{ color: 'var(--color-text-secondary)' }} />
          <span className="text-[12px] font-semibold" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans)' }}>
            Tracked Emails
          </span>
          {!expanded && allEmails.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-secondary)' }}>
              {allEmails.length}
            </span>
          )}
        </div>
        <span
          onClick={(e) => { e.stopPropagation(); setShowAdd(true); setExpanded(true) }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); setShowAdd(true); setExpanded(true) } }}
          role="button"
          tabIndex={0}
          className="h-6 w-6 flex items-center justify-center rounded transition-colors hover:bg-[var(--color-surface-2)] cursor-pointer"
          style={{ color: 'var(--color-text-tertiary)' }}
          title="Add email"
        >
          <Plus size={13} />
        </span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-b" style={{ borderColor: 'var(--color-surface-2)' }}>
          {/* Add form */}
          {showAdd && (
            <div className="px-3 py-2.5 space-y-2 border-b" style={{ borderColor: 'var(--color-surface-2)', background: 'var(--color-surface-1)' }}>
              <Input
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="email@example.com, another@example.com"
                className="h-7 text-[12px] bg-[var(--color-surface-0)] border-[var(--color-surface-3)] focus:border-[var(--color-accent)]"
                onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
              />
              <div className="flex items-center justify-end gap-1.5">
                <button
                  onClick={() => { setShowAdd(false); setAddEmail('') }}
                  className="h-6 px-2 rounded text-[11px] transition-colors hover:bg-[var(--color-surface-2)]"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={saving || !addEmail.trim()}
                  className="h-6 px-3 rounded text-[11px] font-medium transition-colors disabled:opacity-50"
                  style={{ background: 'var(--color-accent)', color: 'var(--color-text-inverse)' }}
                >
                  {saving ? 'Adding...' : 'Add'}
                </button>
              </div>
            </div>
          )}

          {/* Email list */}
          {loading ? (
            <div className="px-3 py-3 space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-5 w-full rounded animate-pulse" style={{ background: 'var(--color-surface-2)' }} />
              ))}
            </div>
          ) : allEmails.length === 0 ? (
            <div className="px-3 py-4 text-center">
              <Mail size={16} style={{ color: 'var(--color-text-tertiary)', opacity: 0.5, margin: '0 auto 6px' }} />
              <p className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                No emails tracked
              </p>
            </div>
          ) : (
            <div className="max-h-[200px] overflow-y-auto">
              {allEmails.map(({ email, contactId }) => (
                <div
                  key={`${contactId}-${email}`}
                  className="flex items-center justify-between px-3 py-2 border-b last:border-b-0 transition-colors hover:bg-[var(--color-surface-1)]"
                  style={{ borderColor: 'var(--color-surface-2)' }}
                >
                  <button
                    type="button"
                    onClick={() => onEmailClick(email, contactId)}
                    className="text-[12px] truncate text-left hover:underline transition-colors flex-1 min-w-0"
                    style={{ color: 'var(--color-accent)' }}
                    title={`Compose email to ${email}`}
                  >
                    {email}
                  </button>
                  {removing?.contactId === contactId && removing?.email === email ? (
                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                      <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>Remove?</span>
                      <button
                        onClick={() => handleRemove(contactId)}
                        className="text-[10px] font-medium hover:underline"
                        style={{ color: 'var(--color-danger-text)' }}
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setRemoving(null)}
                        className="text-[10px] hover:underline"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <span
                      onClick={() => setRemoving({ email, contactId })}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setRemoving({ email, contactId }) } }}
                      className="h-5 w-5 flex items-center justify-center rounded transition-colors hover:bg-[var(--color-surface-2)] cursor-pointer flex-shrink-0 ml-2"
                      style={{ color: 'var(--color-text-tertiary)' }}
                      title="Remove email"
                    >
                      <X size={11} />
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
