'use client'

import { useState, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { Badge } from '@/components/ui/badge'
import { FileSignature, Plus, Check, X, DollarSign, Calendar, User, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'

interface LOIRecord {
  id: string
  deal_id: string
  submitted_at: string | null
  offered_price: number | null
  outcome: string | null
  final_price: number | null
  close_date: string | null
  fallen_through_reason: string | null
  fallen_through_date: string | null
  insurance_declarations: boolean | null
  vendor_service_contracts: boolean | null
  utility_bills: boolean | null
  loi_email: string | null
  last_loi_email_sent_at: string | null
}

interface LOIRound {
  id: string
  loi_id: string
  round_num: number
  price: number | null
  party: string | null
  round_date: string | null
  notes: string | null
}

interface Props {
  dealId: string
}

const OUTCOME_OPTIONS = [
  { value: 'in_progress', label: 'In Progress' },
  { value: 'deal_reached', label: 'Deal Reached' },
  { value: 'fallen_through', label: 'Fallen Through' },
]

const OUTCOME_VARIANTS: Record<string, 'info' | 'success' | 'neutral'> = {
  in_progress: 'info',
  deal_reached: 'success',
  fallen_through: 'neutral',
}

export function LOIDetail({ dealId }: Props) {
  const [loi, setLoi] = useState<LOIRecord | null>(null)
  const [rounds, setRounds] = useState<LOIRound[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [showRoundForm, setShowRoundForm] = useState(false)
  const [newRound, setNewRound] = useState({ price: '', party: 'buyer', round_date: new Date().toISOString().split('T')[0]!, notes: '' })

  useEffect(() => {
    fetch(`/api/deals/${dealId}`)
      .then((r) => r.json())
      .then((deal) => {
        if (deal.loi_records) {
          setLoi(deal.loi_records)
          fetch(`/api/loi/${deal.loi_records.id}/rounds`)
            .then((r) => r.json())
            .then((data) => setRounds(Array.isArray(data) ? data : []))
            .catch(() => {})
        }
      })
      .catch(() => toast.error('Failed to load LOI data'))
      .finally(() => setLoading(false))
  }, [dealId])

  const updateLoi = useCallback((field: string, value: unknown) => {
    setLoi((prev) => prev ? { ...prev, [field]: value } : prev)
    setDirty(true)
  }, [])

  const saveLoi = useCallback(async () => {
    if (!loi) return
    setSaving(true)
    try {
      const res = await fetch(`/api/loi/${loi.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          insurance_declarations: loi.insurance_declarations,
          vendor_service_contracts: loi.vendor_service_contracts,
          utility_bills: loi.utility_bills,
          loi_email: loi.loi_email,
          outcome: loi.outcome,
          final_price: loi.final_price,
          close_date: loi.close_date,
          fallen_through_reason: loi.fallen_through_reason,
          offered_price: loi.offered_price,
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        setLoi((prev) => prev ? { ...prev, ...updated } : prev)
        setDirty(false)
        toast.success('LOI saved')
      } else {
        const json = await res.json()
        toast.error(json.error ?? 'Failed to save')
      }
    } catch {
      toast.error('Failed to save LOI')
    } finally {
      setSaving(false)
    }
  }, [loi])

  const createRound = useCallback(async () => {
    if (!loi) return
    try {
      const res = await fetch(`/api/loi/${loi.id}/rounds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price: newRound.price ? Number(newRound.price) : null,
          party: newRound.party,
          round_date: newRound.round_date || null,
          notes: newRound.notes || null,
        }),
      })
      if (res.ok) {
        const created = await res.json()
        setRounds((prev) => [...prev, created])
        setShowRoundForm(false)
        setNewRound({ price: '', party: 'buyer', round_date: new Date().toISOString().split('T')[0]!, notes: '' })
        toast.success('Round added')
      } else {
        const json = await res.json()
        toast.error(json.error ?? 'Failed to add round')
      }
    } catch {
      toast.error('Failed to add round')
    }
  }, [loi, newRound])

  const createLOI = useCallback(async () => {
    try {
      const res = await fetch('/api/loi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deal_id: dealId,
          submitted_at: new Date().toISOString().split('T')[0],
          offered_price: 0,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setLoi(data)
        toast.success('LOI created')
      } else {
        const json = await res.json()
        toast.error(json.error ?? 'Failed to create LOI')
      }
    } catch {
      toast.error('Failed to create LOI')
    }
  }, [dealId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <LoadingSpinner size="md" />
      </div>
    )
  }

  if (!loi) {
    return (
      <EmptyState
        icon={FileSignature}
        title="No LOI Submitted"
        description="Create a Letter of Intent record for this deal."
        action={{ label: 'Create LOI', onClick: createLOI }}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            LOI Details
          </h3>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
            Submitted {loi.submitted_at ? formatDate(loi.submitted_at) : '—'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={OUTCOME_VARIANTS[loi.outcome ?? 'in_progress'] ?? 'neutral'} size="sm">
            {(loi.outcome ?? 'in_progress').replace(/_/g, ' ')}
          </Badge>
          {dirty && (
            <Button size="sm" onClick={saveLoi} disabled={saving} className="bg-[var(--color-accent)] border-none text-[var(--color-text-inverse)] h-8 text-[12px]">
              {saving ? 'Saving...' : 'Save'}
            </Button>
          )}
        </div>
      </div>

      {/* Key financial fields */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="space-y-1">
          <label className="text-[11px] font-medium uppercase tracking-[0.03em]" style={{ color: 'var(--color-text-tertiary)' }}>Offered Price</label>
          <Input
            type="number"
            value={loi.offered_price ?? ''}
            onChange={(e) => updateLoi('offered_price', e.target.value === '' ? null : Number(e.target.value))}
            className="h-8 text-[13px] font-mono bg-[var(--color-surface-1)] border-[var(--color-surface-3)] focus:border-[var(--color-accent)]"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium uppercase tracking-[0.03em]" style={{ color: 'var(--color-text-tertiary)' }}>Final Price</label>
          <Input
            type="number"
            value={loi.final_price ?? ''}
            onChange={(e) => updateLoi('final_price', e.target.value === '' ? null : Number(e.target.value))}
            className="h-8 text-[13px] font-mono bg-[var(--color-surface-1)] border-[var(--color-surface-3)] focus:border-[var(--color-accent)]"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium uppercase tracking-[0.03em]" style={{ color: 'var(--color-text-tertiary)' }}>Close Date</label>
          <Input
            type="date"
            value={loi.close_date ?? ''}
            onChange={(e) => updateLoi('close_date', e.target.value || null)}
            className="h-8 text-[13px] bg-[var(--color-surface-1)] border-[var(--color-surface-3)] focus:border-[var(--color-accent)]"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium uppercase tracking-[0.03em]" style={{ color: 'var(--color-text-tertiary)' }}>Outcome</label>
          <select
            value={loi.outcome ?? 'in_progress'}
            onChange={(e) => updateLoi('outcome', e.target.value)}
            className="h-8 text-[13px] bg-[var(--color-surface-1)] border border-[var(--color-surface-3)] rounded-md px-2 w-full focus:border-[var(--color-accent)] outline-none"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {OUTCOME_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loi.outcome === 'fallen_through' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg border" style={{ background: 'var(--color-danger-bg)', borderColor: 'var(--color-danger-border)' }}>
          <div className="space-y-1">
            <label className="text-[11px] font-medium uppercase tracking-[0.03em]" style={{ color: 'var(--color-danger-text)' }}>Fallen Through Date</label>
            <Input
              type="date"
              value={loi.fallen_through_date ?? ''}
              onChange={(e) => updateLoi('fallen_through_date', e.target.value || null)}
              className="h-8 text-[13px] bg-[var(--color-surface-1)] border-[var(--color-surface-3)] focus:border-[var(--color-accent)]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium uppercase tracking-[0.03em]" style={{ color: 'var(--color-danger-text)' }}>Reason</label>
            <Input
              value={loi.fallen_through_reason ?? ''}
              onChange={(e) => updateLoi('fallen_through_reason', e.target.value || null)}
              placeholder="Reason deal fell through..."
              className="h-8 text-[13px] bg-[var(--color-surface-1)] border-[var(--color-surface-3)] focus:border-[var(--color-accent)]"
            />
          </div>
        </div>
      )}

      {/* Document tracking */}
      <div>
        <h4 className="text-[11px] font-medium uppercase tracking-[0.03em] mb-3" style={{ color: 'var(--color-text-tertiary)' }}>Required Documents</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { key: 'insurance_declarations', label: 'Insurance Declarations' },
            { key: 'vendor_service_contracts', label: 'Vendor/Service Contracts' },
            { key: 'utility_bills', label: 'Utility Bills' },
          ].map(({ key, label }) => {
            const checked = !!(loi[key as keyof LOIRecord])
            return (
              <button
                key={key}
                onClick={() => updateLoi(key, !checked)}
                className={`flex items-center gap-2 h-10 px-3 rounded-md border text-[13px] transition-colors ${
                  checked
                    ? 'bg-[var(--color-success-bg)] border-[var(--color-success-border)]'
                    : 'bg-[var(--color-surface-1)] border-[var(--color-surface-3)]'
                }`}
                style={{ color: checked ? 'var(--color-success-text)' : 'var(--color-text-secondary)' }}
              >
                {checked ? <Check size={14} /> : <div className="w-3.5 h-3.5 rounded border" style={{ borderColor: 'var(--color-surface-3)' }} />}
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* LOI Email */}
      <div className="space-y-3">
        <h4 className="text-[11px] font-medium uppercase tracking-[0.03em]" style={{ color: 'var(--color-text-tertiary)' }}>LOI Communication</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[11px] font-medium uppercase tracking-[0.03em]" style={{ color: 'var(--color-text-tertiary)' }}>Email for LOI</label>
            <Input
              type="email"
              value={loi.loi_email ?? ''}
              onChange={(e) => updateLoi('loi_email', e.target.value || null)}
              placeholder="broker@example.com"
              className="h-8 text-[13px] bg-[var(--color-surface-1)] border-[var(--color-surface-3)] focus:border-[var(--color-accent)]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium uppercase tracking-[0.03em]" style={{ color: 'var(--color-text-tertiary)' }}>Last LOI Email Sent</label>
            <div className="h-8 flex items-center text-[13px]" style={{ color: 'var(--color-text-primary)' }}>
              {loi.last_loi_email_sent_at ? formatDate(loi.last_loi_email_sent_at) : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* LOI Rounds */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-[11px] font-medium uppercase tracking-[0.03em]" style={{ color: 'var(--color-text-tertiary)' }}>Negotiation Rounds</h4>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowRoundForm(!showRoundForm)}
            className="h-7 text-[11px]"
          >
            <Plus size={12} />
            Add Round
          </Button>
        </div>

        {showRoundForm && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3 p-3 rounded-md border" style={{ background: 'var(--color-surface-1)', borderColor: 'var(--color-surface-3)' }}>
            <div className="space-y-1">
              <label className="text-[10px] font-medium uppercase tracking-[0.03em]" style={{ color: 'var(--color-text-tertiary)' }}>Party</label>
              <select
                value={newRound.party}
                onChange={(e) => setNewRound((p) => ({ ...p, party: e.target.value }))}
                className="h-7 text-[12px] bg-[var(--color-surface-0)] border border-[var(--color-surface-3)] rounded px-1.5 w-full outline-none"
                style={{ color: 'var(--color-text-primary)' }}
              >
                <option value="buyer">Buyer</option>
                <option value="seller">Seller</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium uppercase tracking-[0.03em]" style={{ color: 'var(--color-text-tertiary)' }}>Price</label>
              <Input
                type="number"
                value={newRound.price}
                onChange={(e) => setNewRound((p) => ({ ...p, price: e.target.value }))}
                className="h-7 text-[12px] font-mono bg-[var(--color-surface-0)] border-[var(--color-surface-3)]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium uppercase tracking-[0.03em]" style={{ color: 'var(--color-text-tertiary)' }}>Date</label>
              <Input
                type="date"
                value={newRound.round_date}
                onChange={(e) => setNewRound((p) => ({ ...p, round_date: e.target.value }))}
                className="h-7 text-[12px] bg-[var(--color-surface-0)] border-[var(--color-surface-3)]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium uppercase tracking-[0.03em]" style={{ color: 'var(--color-text-tertiary)' }}>Notes</label>
              <Input
                value={newRound.notes}
                onChange={(e) => setNewRound((p) => ({ ...p, notes: e.target.value }))}
                className="h-7 text-[12px] bg-[var(--color-surface-0)] border-[var(--color-surface-3)]"
              />
            </div>
            <div className="flex items-end gap-1">
              <Button size="sm" onClick={createRound} className="h-7 text-[11px] bg-[var(--color-accent)] border-none text-[var(--color-text-inverse)]">
                <Check size={12} /> Add
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowRoundForm(false)} className="h-7 text-[11px]">
                <X size={12} />
              </Button>
            </div>
          </div>
        )}

        {rounds.length === 0 ? (
          <p className="text-[12px] py-2" style={{ color: 'var(--color-text-tertiary)' }}>No negotiation rounds yet.</p>
        ) : (
          <div className="border rounded-md overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
            <table className="w-full text-[12px]">
              <thead style={{ background: 'var(--color-surface-1)' }}>
                <tr>
                  <th className="text-left px-3 py-2 text-[11px] font-medium uppercase tracking-[0.03em]" style={{ color: 'var(--color-text-tertiary)' }}>Round</th>
                  <th className="text-left px-3 py-2 text-[11px] font-medium uppercase tracking-[0.03em]" style={{ color: 'var(--color-text-tertiary)' }}>Party</th>
                  <th className="text-left px-3 py-2 text-[11px] font-medium uppercase tracking-[0.03em]" style={{ color: 'var(--color-text-tertiary)' }}>Price</th>
                  <th className="text-left px-3 py-2 text-[11px] font-medium uppercase tracking-[0.03em]" style={{ color: 'var(--color-text-tertiary)' }}>Date</th>
                  <th className="text-left px-3 py-2 text-[11px] font-medium uppercase tracking-[0.03em]" style={{ color: 'var(--color-text-tertiary)' }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {rounds.map((r) => (
                  <tr key={r.id} className="border-t" style={{ borderColor: 'var(--color-surface-2)' }}>
                    <td className="px-3 py-2 font-medium" style={{ color: 'var(--color-text-primary)' }}>#{r.round_num}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--color-text-primary)' }}>
                      <Badge variant={r.party === 'buyer' ? 'info' : 'neutral'} size="sm">{r.party ?? '—'}</Badge>
                    </td>
                    <td className="px-3 py-2 font-mono" style={{ color: 'var(--color-text-primary)' }}>
                      {r.price ? `$${r.price.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-3 py-2" style={{ color: 'var(--color-text-secondary)' }}>{r.round_date ?? '—'}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--color-text-secondary)' }}>{r.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
