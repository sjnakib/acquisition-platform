'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDeal } from '@/lib/hooks/useDeal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { Badge } from '@/components/ui/badge'
import { FileSignature, Plus, Check, X } from 'lucide-react'
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

interface DealWithLOI {
  loi_records?: LOIRecord
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
  const queryClient = useQueryClient()

  // ── Deal data (TanStack Query, shared cache) ───────────────────────────
  const { data: deal, isLoading: dealLoading } = useDeal<DealWithLOI>(dealId)

  // ── Local form state (unsaved edits) ────────────────────────────────────
  const [loi, setLoi] = useState<LOIRecord | null>(null)
  const [initialized, setInitialized] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [showRoundForm, setShowRoundForm] = useState(false)
  const [newRound, setNewRound] = useState({ price: '', party: 'buyer', round_date: new Date().toISOString().split('T')[0]!, notes: '' })

  // Initialize local state from deal data (once)
  if (deal?.loi_records && !initialized) {
    setLoi(deal.loi_records)
    setInitialized(true)
  }

  // Reset when deal changes (e.g., tab switch, refetch)
  if (deal?.loi_records && initialized && deal.loi_records.id !== (loi?.id ?? '')) {
    setLoi(deal.loi_records)
    setDirty(false)
  }

  const loiId = deal?.loi_records?.id

  // ── TanStack Query: LOI rounds ─────────────────────────────────────────

  const { data: rounds = [], isLoading: roundsLoading } = useQuery<LOIRound[]>({
    queryKey: ['loi-rounds', loiId],
    queryFn: async () => {
      const res = await fetch(`/api/loi/${loiId}/rounds`)
      if (!res.ok) throw new Error('Failed to load rounds')
      const data = await res.json()
      return Array.isArray(data) ? data : []
    },
    enabled: !!loiId,
    staleTime: 60_000,
  })

  // ── TanStack Query: update LOI ─────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!loi) return
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
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Failed to save')
      }
      return res.json()
    },
    onSuccess: (updated) => {
      if (updated) {
        setLoi((prev) => prev ? { ...prev, ...updated } : prev)
      }
      setDirty(false)
      queryClient.invalidateQueries({ queryKey: ['deal', dealId] })
      toast.success('LOI saved')
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to save LOI'),
  })

  // ── TanStack Query: create round ───────────────────────────────────────

  const createRoundMutation = useMutation({
    mutationFn: async () => {
      if (!loi) return
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
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Failed to add round')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loi-rounds', loiId] })
      setShowRoundForm(false)
      setNewRound({ price: '', party: 'buyer', round_date: new Date().toISOString().split('T')[0]!, notes: '' })
      toast.success('Round added')
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to add round'),
  })

  // ── TanStack Query: create LOI ─────────────────────────────────────────

  const createLOIMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/loi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deal_id: dealId,
          submitted_at: new Date().toISOString().split('T')[0],
          offered_price: 0,
        }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Failed to create LOI')
      }
      return res.json()
    },
    onSuccess: (data) => {
      setLoi(data)
      setInitialized(true)
      queryClient.invalidateQueries({ queryKey: ['deal', dealId] })
      toast.success('LOI created')
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to create LOI'),
  })

  // ── Form update ────────────────────────────────────────────────────────

  const updateLoi = useCallback((field: string, value: unknown) => {
    setLoi((prev) => prev ? { ...prev, [field]: value } : prev)
    setDirty(true)
  }, [])

  // ── Loading state ──────────────────────────────────────────────────────

  if (dealLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <LoadingSpinner size="md" />
      </div>
    )
  }

  // ── Empty state (no LOI yet) ───────────────────────────────────────────

  if (!loi) {
    return (
      <EmptyState
        icon={FileSignature}
        title="No LOI Submitted"
        description="Create a Letter of Intent record for this deal."
        action={{
          label: createLOIMutation.isPending ? 'Creating…' : 'Create LOI',
          onClick: () => createLOIMutation.mutate(),
        }}
      />
    )
  }

  // ── Main render ────────────────────────────────────────────────────────

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
            <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="bg-[var(--color-accent)] border-none text-[var(--color-text-inverse)] h-8 text-[12px]">
              {saveMutation.isPending ? 'Saving…' : 'Save'}
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
              <Button size="sm" onClick={() => createRoundMutation.mutate()} disabled={createRoundMutation.isPending} className="h-7 text-[11px] bg-[var(--color-accent)] border-none text-[var(--color-text-inverse)]">
                <Check size={12} /> Add
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowRoundForm(false)} className="h-7 text-[11px]">
                <X size={12} />
              </Button>
            </div>
          </div>
        )}

        {/* Rounds table */}
        {roundsLoading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="sm" />
          </div>
        ) : rounds.length === 0 ? (
          <p className="text-[12px] py-4" style={{ color: 'var(--color-text-tertiary)' }}>No negotiation rounds yet.</p>
        ) : (
          <div className="border rounded-md overflow-hidden" style={{ borderColor: 'var(--color-surface-2)' }}>
            <table className="w-full text-[12px]">
              <thead>
                <tr style={{ background: 'var(--color-surface-1)' }}>
                  <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-[0.03em]" style={{ color: 'var(--color-text-tertiary)' }}>Round</th>
                  <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-[0.03em]" style={{ color: 'var(--color-text-tertiary)' }}>Party</th>
                  <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-[0.03em]" style={{ color: 'var(--color-text-tertiary)' }}>Price</th>
                  <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-[0.03em]" style={{ color: 'var(--color-text-tertiary)' }}>Date</th>
                  <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-[0.03em]" style={{ color: 'var(--color-text-tertiary)' }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {rounds.map((round) => (
                  <tr key={round.id} className="border-t" style={{ borderColor: 'var(--color-surface-2)' }}>
                    <td className="px-3 py-2 font-mono" style={{ color: 'var(--color-text-secondary)' }}>#{round.round_num}</td>
                    <td className="px-3 py-2 capitalize" style={{ color: 'var(--color-text-primary)' }}>{round.party}</td>
                    <td className="px-3 py-2 font-mono" style={{ color: 'var(--color-text-primary)' }}>
                      {round.price != null ? `$${round.price.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-3 py-2" style={{ color: 'var(--color-text-secondary)' }}>
                      {round.round_date ? formatDate(round.round_date) : '—'}
                    </td>
                    <td className="px-3 py-2 truncate max-w-[200px]" style={{ color: 'var(--color-text-secondary)' }}>
                      {round.notes || '—'}
                    </td>
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
