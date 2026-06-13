'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDeal } from '@/lib/hooks/useDeal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { Badge } from '@/components/ui/badge'
import { FileSignature, Plus, Check, X, CheckCircle2, Clock, XCircle, Calendar, DollarSign, ArrowRightLeft, FileText } from 'lucide-react'
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
      queryClient.invalidateQueries({ queryKey: ['deals'] })
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
      queryClient.invalidateQueries({ queryKey: ['deals'] })
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
        description="Create a Letter of Intent record for this deal to track negotiations."
        action={{
          label: createLOIMutation.isPending ? 'Creating…' : 'Create LOI',
          onClick: () => createLOIMutation.mutate(),
        }}
      />
    )
  }

  // ── Main render ────────────────────────────────────────────────────────

  // Compute active outcome steps
  const activeOutcome = loi.outcome ?? 'in_progress'

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex items-center justify-between pb-3 border-b border-[var(--color-surface-2)]">
        <div>
          <h3 className="text-[14px] font-bold text-[var(--color-text-primary)]">
            Letter of Intent (LOI) Details
          </h3>
          <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">
            Manage offered pricing, negotiate rounds, check required documents, and track close/outcomes.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {dirty && (
            <Button 
              size="sm" 
              onClick={() => saveMutation.mutate()} 
              disabled={saveMutation.isPending} 
              className="bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90 text-[var(--color-text-inverse)] h-8 text-[12px] font-medium shadow-xs"
            >
              {saveMutation.isPending ? <LoadingSpinner size="sm" /> : 'Save LOI'}
            </Button>
          )}
        </div>
      </div>

      {/* Stepper progress indicator */}
      <div className="rounded-xl border p-4 bg-[var(--color-surface-0)] border-[var(--color-surface-2)] shadow-xs">
        <div className="flex items-center justify-between">
          {/* Step 1 */}
          <div className="flex flex-col items-center flex-1 text-center relative">
            <div className="w-7 h-7 rounded-full bg-[rgba(30,91,63,0.1)] text-[var(--color-accent)] flex items-center justify-center border border-[var(--color-accent)] z-10">
              <Check size={14} className="stroke-[3]" />
            </div>
            <span className="text-[11px] font-semibold mt-1.5 text-[var(--color-text-primary)]">LOI Drafted</span>
          </div>

          <div className="h-0.5 flex-1 bg-[var(--color-accent)] -mt-5" />

          {/* Step 2 */}
          <div className="flex flex-col items-center flex-1 text-center relative">
            <div className="w-7 h-7 rounded-full bg-[rgba(30,91,63,0.1)] text-[var(--color-accent)] flex items-center justify-center border border-[var(--color-accent)] z-10">
              <Check size={14} className="stroke-[3]" />
            </div>
            <span className="text-[11px] font-semibold mt-1.5 text-[var(--color-text-primary)]">LOI Submitted</span>
            <span className="text-[9px] text-[var(--color-text-tertiary)] block mt-0.5">
              {loi.submitted_at ? formatDate(loi.submitted_at) : ''}
            </span>
          </div>

          <div className={`h-0.5 flex-1 -mt-5 ${activeOutcome !== 'in_progress' ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-surface-3)]'}`} />

          {/* Step 3 */}
          <div className="flex flex-col items-center flex-1 text-center relative">
            {activeOutcome === 'in_progress' ? (
              <div className="w-7 h-7 rounded-full bg-[var(--color-info-bg)] text-[var(--color-info-text)] flex items-center justify-center border border-[var(--color-info-border)] animate-pulse z-10">
                <Clock size={12} />
              </div>
            ) : (
              <div className="w-7 h-7 rounded-full bg-[rgba(30,91,63,0.1)] text-[var(--color-accent)] flex items-center justify-center border border-[var(--color-accent)] z-10">
                <Check size={14} className="stroke-[3]" />
              </div>
            )}
            <span className="text-[11px] font-semibold mt-1.5 text-[var(--color-text-primary)]">Negotiations</span>
          </div>

          <div className={`h-0.5 flex-1 -mt-5 ${activeOutcome !== 'in_progress' ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-surface-3)]'}`} />

          {/* Step 4 */}
          <div className="flex flex-col items-center flex-1 text-center relative">
            {activeOutcome === 'in_progress' ? (
              <div className="w-7 h-7 rounded-full bg-[var(--color-surface-1)] text-[var(--color-text-tertiary)] flex items-center justify-center border border-[var(--color-surface-3)] z-10">
                4
              </div>
            ) : activeOutcome === 'deal_reached' ? (
              <div className="w-7 h-7 rounded-full bg-[var(--color-success-bg)] text-[var(--color-success-text)] flex items-center justify-center border border-[var(--color-success-border)] z-10">
                <CheckCircle2 size={14} className="fill-current" />
              </div>
            ) : (
              <div className="w-7 h-7 rounded-full bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] flex items-center justify-center border border-[var(--color-danger-border)] z-10">
                <XCircle size={14} className="fill-current" />
              </div>
            )}
            <span className="text-[11px] font-semibold mt-1.5 text-[var(--color-text-primary)]">
              {activeOutcome === 'deal_reached' ? 'Deal Reached' : activeOutcome === 'fallen_through' ? 'Fallen Through' : 'Resolution'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Parameters Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Offered Price */}
        <div className="rounded-xl border p-4 bg-[var(--color-surface-0)] border-[var(--color-surface-2)] shadow-xs">
          <label className="text-[10px] font-semibold uppercase tracking-[0.03em] text-[var(--color-text-tertiary)] block mb-1">
            Offered Price
          </label>
          <div className="relative">
            <DollarSign className="absolute left-2.5 h-3.5 w-3.5 text-[var(--color-text-tertiary)] top-1/2 -translate-y-1/2" />
            <Input
              type="number"
              value={loi.offered_price ?? ''}
              onChange={(e) => updateLoi('offered_price', e.target.value === '' ? null : Number(e.target.value))}
              className="h-8 pl-7 text-[13px] font-mono bg-[var(--color-surface-1)] border-[var(--color-surface-3)] focus:border-[var(--color-accent)] w-full"
            />
          </div>
        </div>

        {/* Final Price */}
        <div className="rounded-xl border p-4 bg-[var(--color-surface-0)] border-[var(--color-surface-2)] shadow-xs">
          <label className="text-[10px] font-semibold uppercase tracking-[0.03em] text-[var(--color-text-tertiary)] block mb-1">
            Final Price
          </label>
          <div className="relative">
            <DollarSign className="absolute left-2.5 h-3.5 w-3.5 text-[var(--color-text-tertiary)] top-1/2 -translate-y-1/2" />
            <Input
              type="number"
              value={loi.final_price ?? ''}
              onChange={(e) => updateLoi('final_price', e.target.value === '' ? null : Number(e.target.value))}
              className="h-8 pl-7 text-[13px] font-mono bg-[var(--color-surface-1)] border-[var(--color-surface-3)] focus:border-[var(--color-accent)] w-full"
            />
          </div>
        </div>

        {/* Close Date */}
        <div className="rounded-xl border p-4 bg-[var(--color-surface-0)] border-[var(--color-surface-2)] shadow-xs">
          <label className="text-[10px] font-semibold uppercase tracking-[0.03em] text-[var(--color-text-tertiary)] block mb-1">
            Close Date
          </label>
          <Input
            type="date"
            value={loi.close_date ?? ''}
            onChange={(e) => updateLoi('close_date', e.target.value || null)}
            className="h-8 text-[13px] bg-[var(--color-surface-1)] border-[var(--color-surface-3)] focus:border-[var(--color-accent)] w-full"
          />
        </div>

        {/* Outcome Selector */}
        <div className="rounded-xl border p-4 bg-[var(--color-surface-0)] border-[var(--color-surface-2)] shadow-xs">
          <label className="text-[10px] font-semibold uppercase tracking-[0.03em] text-[var(--color-text-tertiary)] block mb-1">
            LOI Outcome
          </label>
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

      {/* Outcome-Specific Cards */}
      {loi.outcome === 'fallen_through' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl border bg-[var(--color-danger-bg)] border-[var(--color-danger-border)] text-[var(--color-danger-text)]">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-[0.03em] block">Fallen Through Date</label>
            <Input
              type="date"
              value={loi.fallen_through_date ?? ''}
              onChange={(e) => updateLoi('fallen_through_date', e.target.value || null)}
              className="h-8 text-[13px] bg-[var(--color-surface-0)] border-[var(--color-danger-border)] text-[var(--color-text-primary)]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-[0.03em] block">Fallen Through Reason</label>
            <Input
              value={loi.fallen_through_reason ?? ''}
              onChange={(e) => updateLoi('fallen_through_reason', e.target.value || null)}
              placeholder="Enter details on why deal fell through..."
              className="h-8 text-[13px] bg-[var(--color-surface-0)] border-[var(--color-danger-border)] text-[var(--color-text-primary)]"
            />
          </div>
        </div>
      )}

      {/* Document tracking & Email Communication Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Diligence Checklist */}
        <div className="lg:col-span-3 rounded-xl border p-5 bg-[var(--color-surface-0)] border-[var(--color-surface-2)] shadow-xs space-y-3">
          <h4 className="text-[12px] font-bold text-[var(--color-text-primary)] pb-1.5 border-b border-[var(--color-surface-2)] flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-[var(--color-accent)]" />
            Required Diligence Checklist
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { key: 'insurance_declarations', label: 'Insurance Declarations', desc: 'Coverages & policies' },
              { key: 'vendor_service_contracts', label: 'Vendor Service Contracts', desc: 'Waste, elevator, laundry' },
              { key: 'utility_bills', label: 'Utility Bills', desc: 'Gas, electric, water logs' },
            ].map(({ key, label, desc }) => {
              const checked = !!(loi[key as keyof LOIRecord])
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => updateLoi(key, !checked)}
                  className={`flex flex-col items-start gap-1 p-3 rounded-xl border transition-all text-left shadow-xs ${
                    checked
                      ? 'bg-[var(--color-success-bg)] border-[var(--color-success-border)] text-[var(--color-success-text)]'
                      : 'bg-[var(--color-surface-1)] border-[var(--color-surface-3)] hover:border-[var(--color-surface-3)]/80 text-[var(--color-text-secondary)]'
                  }`}
                >
                  <div className="flex items-center gap-2 w-full justify-between">
                    <span className="text-xs font-bold">{label}</span>
                    {checked ? (
                      <CheckCircle2 size={14} className="fill-current text-[var(--color-success-text)]" />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded border border-[var(--color-surface-3)]" />
                    )}
                  </div>
                  <span className="text-[10px] text-[var(--color-text-tertiary)] block mt-0.5 leading-normal">
                    {desc}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Communication Block */}
        <div className="lg:col-span-2 rounded-xl border p-5 bg-[var(--color-surface-0)] border-[var(--color-surface-2)] shadow-xs space-y-4">
          <h4 className="text-[12px] font-bold text-[var(--color-text-primary)] pb-1.5 border-b border-[var(--color-surface-2)] flex items-center gap-1.5">
            <FileText className="h-4 w-4 text-[var(--color-accent)]" />
            LOI Email Dispatch
          </h4>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-[0.03em] text-[var(--color-text-secondary)]">Broker Email for LOI</label>
              <Input
                type="email"
                value={loi.loi_email ?? ''}
                onChange={(e) => updateLoi('loi_email', e.target.value || null)}
                placeholder="broker@example.com"
                className="h-8 text-[13px] bg-[var(--color-surface-1)] border-[var(--color-surface-3)] focus:border-[var(--color-accent)] w-full"
              />
            </div>
            <div className="flex justify-between items-center pt-1.5 text-[11px]">
              <span className="font-semibold text-[var(--color-text-secondary)]">Last Dispatched:</span>
              <span className="font-mono text-[var(--color-text-tertiary)]">
                {loi.last_loi_email_sent_at ? formatDate(loi.last_loi_email_sent_at) : 'Never sent'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Negotiation Rounds Timeline */}
      <div className="rounded-xl border p-5 bg-[var(--color-surface-0)] border-[var(--color-surface-2)] shadow-xs">
        <div className="flex items-center justify-between pb-2 border-b border-[var(--color-surface-2)] mb-4">
          <h4 className="text-[12px] font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
            <ArrowRightLeft className="h-4 w-4 text-[var(--color-accent)]" />
            Negotiation & Offer Rounds
          </h4>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowRoundForm(!showRoundForm)}
            className="h-7 px-2.5 text-[11px] font-medium border-[var(--color-surface-3)]"
          >
            {showRoundForm ? <X size={12} className="mr-1" /> : <Plus size={12} className="mr-1" />}
            {showRoundForm ? 'Cancel' : 'Add Round'}
          </Button>
        </div>

        {/* Add Round Form */}
        {showRoundForm && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 p-4 rounded-xl border border-[var(--color-surface-3)] bg-[var(--color-surface-1)] mb-4 transition-all">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-[0.03em] text-[var(--color-text-secondary)]">Party</label>
              <select
                value={newRound.party}
                onChange={(e) => setNewRound((p) => ({ ...p, party: e.target.value }))}
                className="h-8 text-[12px] bg-[var(--color-surface-0)] border border-[var(--color-surface-3)] rounded px-2 w-full outline-none"
                style={{ color: 'var(--color-text-primary)' }}
              >
                <option value="buyer">Buyer (Our Side)</option>
                <option value="seller">Seller (Broker/Owner)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-[0.03em] text-[var(--color-text-secondary)]">Price Counter</label>
              <div className="relative">
                <DollarSign className="absolute left-2 h-3 text-[var(--color-text-tertiary)] top-1/2 -translate-y-1/2" />
                <Input
                  type="number"
                  value={newRound.price}
                  onChange={(e) => setNewRound((p) => ({ ...p, price: e.target.value }))}
                  className="h-8 pl-6 text-[12px] font-mono bg-[var(--color-surface-0)] border-[var(--color-surface-3)]"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-[0.03em] text-[var(--color-text-secondary)]">Date</label>
              <Input
                type="date"
                value={newRound.round_date}
                onChange={(e) => setNewRound((p) => ({ ...p, round_date: e.target.value }))}
                className="h-8 text-[12px] bg-[var(--color-surface-0)] border-[var(--color-surface-3)]"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-[10px] font-semibold uppercase tracking-[0.03em] text-[var(--color-text-secondary)]">Notes</label>
              <div className="flex gap-2">
                <Input
                  value={newRound.notes}
                  onChange={(e) => setNewRound((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Terms, contingencies, reactions..."
                  className="h-8 text-[12px] bg-[var(--color-surface-0)] border-[var(--color-surface-3)] flex-1"
                />
                <Button 
                  size="sm" 
                  onClick={() => createRoundMutation.mutate()} 
                  disabled={createRoundMutation.isPending} 
                  className="h-8 text-[11px] font-medium bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90 text-[var(--color-text-inverse)]"
                >
                  {createRoundMutation.isPending ? <LoadingSpinner size="sm" /> : 'Add'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Rounds visual feed */}
        {roundsLoading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="sm" />
          </div>
        ) : rounds.length === 0 ? (
          <p className="text-[12px] text-[var(--color-text-tertiary)] py-4 text-center">No negotiation rounds logged yet.</p>
        ) : (
          <div className="relative pl-6 space-y-4 pt-1">
            {/* Vertical connector line */}
            <div 
              className="absolute left-3 top-2.5 bottom-2.5 w-0.5" 
              style={{ background: 'var(--color-surface-2)' }} 
            />

            {rounds.map((round) => {
              const isBuyer = round.party === 'buyer'
              return (
                <div
                  key={round.id}
                  className={`relative flex flex-col md:flex-row md:items-center gap-4 rounded-xl p-3 border border-[var(--color-surface-2)] transition-colors hover:bg-[var(--color-surface-1)] shadow-xs bg-[var(--color-surface-0)] ${
                    isBuyer ? 'border-l-4 border-l-[var(--color-accent)]' : 'border-l-4 border-l-amber-500'
                  }`}
                >
                  {/* Circle round index on line */}
                  <div
                    className={`absolute -left-6 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border shadow-xs z-10 -translate-x-1/2 ${
                      isBuyer 
                        ? 'bg-[rgba(30,91,63,0.1)] border-[var(--color-accent)] text-[var(--color-accent)]' 
                        : 'bg-amber-50 border-amber-500 text-amber-600'
                    }`}
                  >
                    #{round.round_num}
                  </div>

                  {/* Left Side: Party & Price */}
                  <div className="flex items-center gap-3 min-w-[200px]">
                    <Badge variant={isBuyer ? 'success' : 'warning'} className="font-semibold px-2 py-0.5 text-[10px]">
                      {isBuyer ? 'Buyer (Us)' : 'Seller'}
                    </Badge>
                    <span className="text-sm font-bold font-mono text-[var(--color-text-primary)]">
                      {round.price != null ? `$${round.price.toLocaleString()}` : '—'}
                    </span>
                  </div>

                  {/* Date */}
                  <div className="text-[11px] text-[var(--color-text-tertiary)] font-medium inline-flex items-center gap-1 min-w-[120px]">
                    <Calendar size={12} />
                    {round.round_date ? formatDate(round.round_date) : '—'}
                  </div>

                  {/* Notes / Contingencies */}
                  <div className="flex-1 text-[12px] text-[var(--color-text-secondary)] leading-relaxed italic bg-[var(--color-surface-1)] py-1.5 px-3 rounded-lg border border-[var(--color-surface-2)]">
                    {round.notes || <span className="text-[var(--color-text-tertiary)]">No notes recorded.</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

