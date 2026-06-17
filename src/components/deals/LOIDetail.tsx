'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDeal } from '@/lib/hooks/useDeal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { Badge } from '@/components/ui/badge'
import { FileSignature, Plus, Check, X, CheckCircle2, Clock, XCircle, Calendar, DollarSign, ArrowRightLeft, FileText, AlertTriangle, Info } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface LOIRecord {
  id: string
  deal_id: string
  submitted_at: string | null
  offered_price: number | string | null
  outcome: string | null
  final_price: number | string | null
  close_date: string | null
  fallen_through_reason: string | null
  fallen_through_date: string | null
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
  stage: string
  underwriting?: {
    loi_recommendation: boolean | null
    underwritability_status: string | null
  } | null
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
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showRoundForm, setShowRoundForm] = useState(false)
  const [newRound, setNewRound] = useState({ price: '', party: 'buyer', round_date: new Date().toISOString().split('T')[0]!, notes: '' })
  const [newRoundErrors, setNewRoundErrors] = useState<Record<string, string>>({})

  // Initialize local state from deal data (once)
  if (deal?.loi_records && !initialized) {
    setLoi(deal.loi_records)
    setInitialized(true)
    setErrors({})
  }

  // Reset when deal changes (e.g., tab switch, refetch)
  if (deal?.loi_records && initialized && deal.loi_records.id !== (loi?.id ?? '')) {
    setLoi(deal.loi_records)
    setDirty(false)
    setErrors({})
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

  // ── Validation logic ───────────────────────────────────────────────────

  const validateField = useCallback((field: string, rawVal: string): string | null => {
    const trimmed = rawVal.trim()
    if (trimmed === '') return null // nullable is valid when empty

    if (['offered_price', 'final_price'].includes(field)) {
      const val = Number(trimmed)
      if (isNaN(val)) return 'Must be a valid number'
      if (val < 0) return 'Must be a non-negative amount'
    }

    if (['close_date', 'fallen_through_date'].includes(field)) {
      const timestamp = Date.parse(trimmed)
      if (isNaN(timestamp)) return 'Must be a valid date'
    }

    if (field === 'loi_email') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        return 'Must be a valid email address'
      }
    }

    return null
  }, [])

  const validateRoundField = useCallback((field: string, valStr: string): string | null => {
    const trimmed = valStr.trim()
    if (field === 'price') {
      if (trimmed === '') return 'Price is required'
      const val = Number(trimmed)
      if (isNaN(val)) return 'Must be a valid number'
      if (val < 0) return 'Must be a non-negative amount'
    }
    if (field === 'round_date') {
      if (trimmed === '') return 'Date is required'
      const timestamp = Date.parse(trimmed)
      if (isNaN(timestamp)) return 'Must be a valid date'
    }
    return null
  }, [])

  // ── TanStack Query: update LOI ─────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!loi) return
      
      const parsedData = {
        loi_email: loi.loi_email,
        last_loi_email_sent_at: loi.last_loi_email_sent_at,
        outcome: loi.outcome,
        final_price: loi.final_price != null ? Number(loi.final_price) : null,
        close_date: loi.close_date,
        fallen_through_reason: loi.fallen_through_reason,
        fallen_through_date: loi.fallen_through_date,
        offered_price: loi.offered_price != null ? Number(loi.offered_price) : 0,
      }

      const res = await fetch(`/api/loi/${loi.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsedData),
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
      setNewRoundErrors({})
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

  // ── Form updates ───────────────────────────────────────────────────────

  const updateLoi = useCallback((field: string, value: string | null) => {
    setLoi((prev) => prev ? { ...prev, [field]: value } : prev)
    setDirty(true)

    const err = validateField(field, value ?? '')
    setErrors((prev) => ({ ...prev, [field]: err ?? '' }))
  }, [validateField])

  const handleNewRoundChange = useCallback((field: string, value: string) => {
    setNewRound((p) => ({ ...p, [field]: value }))
    const err = validateRoundField(field, value)
    setNewRoundErrors((prev) => ({ ...prev, [field]: err ?? '' }))
  }, [validateRoundField])

  const submitRound = () => {
    const priceErr = validateRoundField('price', newRound.price)
    const dateErr = validateRoundField('round_date', newRound.round_date)
    if (priceErr || dateErr) {
      setNewRoundErrors({
        price: priceErr ?? '',
        round_date: dateErr ?? '',
      })
      toast.error('Please correct errors in round details.')
      return
    }
    createRoundMutation.mutate()
  }

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

  // ── System Inconsistency Alert Logic ───────────────────────────────────
  const dealStage = deal?.stage ?? 'lead'
  const underwritabilityStatus = deal?.underwriting?.underwritability_status
  const loiRec = deal?.underwriting?.loi_recommendation

  const hasErrors = Object.values(errors).some(Boolean)
  const activeOutcome = loi.outcome ?? 'in_progress'

  function numberField(label: string, field: keyof LOIRecord, options?: { placeholder?: string }) {
    const val = loi?.[field]
    const err = errors[field]
    const hasError = !!err

    return (
      <div className="rounded-xl border p-4 bg-[var(--color-surface-0)] border-[var(--color-surface-2)] shadow-xs">
        <label className="text-[10px] font-semibold uppercase tracking-[0.03em] text-[var(--color-text-tertiary)] block mb-1">
          {label}
        </label>
        <div className="relative flex flex-col gap-1">
          <div className="relative flex items-center">
            <DollarSign className="absolute left-2.5 h-3.5 w-3.5 text-[var(--color-text-tertiary)] top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              value={val != null ? String(val) : ''}
              onChange={(e) => updateLoi(field, e.target.value)}
              placeholder={options?.placeholder ?? '—'}
              className={cn(
                "h-8 pl-7 text-[13px] font-mono bg-[var(--color-surface-1)] border-[var(--color-surface-3)] focus:border-[var(--color-accent)] w-full transition-all",
                hasError && "border-[var(--color-danger-border)] focus:border-[var(--color-danger-border)] focus:ring-1 focus:ring-[var(--color-danger-border)] bg-[rgba(239,68,68,0.03)] animate-card-shake"
              )}
            />
          </div>
          {err && (
            <span className="text-[10px] text-[var(--color-danger-text)] font-semibold mt-0.5 leading-none animate-tab-entrance">
              {err}
            </span>
          )}
        </div>
      </div>
    )
  }

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
              disabled={saveMutation.isPending || hasErrors} 
              className="bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90 text-[var(--color-text-inverse)] h-8 text-[12px] font-medium shadow-xs gap-1.5"
            >
              {saveMutation.isPending ? <LoadingSpinner size="sm" /> : <Check size={12} />}
              Save LOI
            </Button>
          )}
        </div>
      </div>

      {/* ── System State Inconsistencies Feedback Banners ── */}
      <div className="space-y-2.5">
        {dealStage === 'loi' && underwritabilityStatus === 'no_go' && (
          <div className="p-3.5 rounded-xl border flex gap-3 bg-[var(--color-danger-bg)] border-[var(--color-danger-border)] text-[var(--color-danger-text)] text-[12px] animate-tab-entrance">
            <AlertTriangle className="h-4.5 w-4.5 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Inconsistent State: Underwriting &quot;No-Go&quot;</span>
              <p className="mt-0.5 opacity-90 leading-relaxed">
                The underwriting screening for this deal is set to <strong>No-Go / Not Underwritable</strong>. 
                Proceeding with a Letter of Intent contradicts this decision.
              </p>
            </div>
          </div>
        )}
        {dealStage === 'loi' && loiRec === false && (
          <div className="p-3.5 rounded-xl border flex gap-3 bg-[var(--color-warning-bg)] border-[var(--color-warning-border)] text-[var(--color-warning-text)] text-[12px] animate-tab-entrance">
            <AlertTriangle className="h-4.5 w-4.5 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Inconsistent State: Hold in Screening</span>
              <p className="mt-0.5 opacity-90 leading-relaxed">
                Underwriting models recommend a <strong>Hold in Screening</strong> (do not proceed with LOI). 
                Please align parameters or update recommendations.
              </p>
            </div>
          </div>
        )}
        {dealStage === 'loi' && (!underwritabilityStatus) && (
          <div className="p-3.5 rounded-xl border flex gap-3 bg-[var(--color-info-bg)] border-[var(--color-info-border)] text-[var(--color-info-text)] text-[12px] animate-tab-entrance">
            <Info className="h-4.5 w-4.5 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Underwriting Screening Incomplete</span>
              <p className="mt-0.5 opacity-90 leading-relaxed">
                Underwriting has not yet been evaluated for this deal. 
                We recommend completing the Underwriting tab metrics first to ensure offer feasibility.
              </p>
            </div>
          </div>
        )}
        {dealStage === 'closed' && activeOutcome !== 'deal_reached' && (
          <div className="p-3.5 rounded-xl border flex gap-3 bg-[var(--color-warning-bg)] border-[var(--color-warning-border)] text-[var(--color-warning-text)] text-[12px] animate-tab-entrance">
            <AlertTriangle className="h-4.5 w-4.5 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Outcome Mismatch: Stage is &apos;Closed&apos;</span>
              <p className="mt-0.5 opacity-90 leading-relaxed">
                The deal stage is marked as <strong>Closed</strong>, but the LOI outcome is <strong>{activeOutcome.replace(/_/g, ' ')}</strong>. 
                For a closed deal, the outcome should typically be updated to <strong>Deal Reached</strong>.
              </p>
            </div>
          </div>
        )}
        {dealStage === 'failed' && activeOutcome !== 'fallen_through' && (
          <div className="p-3.5 rounded-xl border flex gap-3 bg-[var(--color-warning-bg)] border-[var(--color-warning-border)] text-[var(--color-warning-text)] text-[12px] animate-tab-entrance">
            <AlertTriangle className="h-4.5 w-4.5 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Outcome Mismatch: Stage is &apos;Failed&apos;</span>
              <p className="mt-0.5 opacity-90 leading-relaxed">
                The deal stage is marked as <strong>Failed</strong>, but the LOI outcome is <strong>{activeOutcome.replace(/_/g, ' ')}</strong>. 
                For a failed deal, the outcome should typically be updated to <strong>Fallen Through</strong>.
              </p>
            </div>
          </div>
        )}
        {dealStage === 'loi' && activeOutcome !== 'in_progress' && (
          <div className="p-3.5 rounded-xl border flex gap-3 bg-[var(--color-info-bg)] border-[var(--color-info-border)] text-[var(--color-info-text)] text-[12px] animate-tab-entrance">
            <Info className="h-4.5 w-4.5 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Negotiations Concluded</span>
              <p className="mt-0.5 opacity-90 leading-relaxed">
                Negotiations have concluded with the outcome <strong>{activeOutcome.replace(/_/g, ' ')}</strong>. 
                You should transition the deal stage in the header to <strong>Closed</strong> or <strong>Failed</strong>.
              </p>
            </div>
          </div>
        )}
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
        {numberField('Offered Price', 'offered_price', { placeholder: 'e.g. 14500000' })}
        {numberField('Final Price', 'final_price', { placeholder: 'e.g. 14350000' })}

        {/* Close Date */}
        <div className="rounded-xl border p-4 bg-[var(--color-surface-0)] border-[var(--color-surface-2)] shadow-xs">
          <label className="text-[10px] font-semibold uppercase tracking-[0.03em] text-[var(--color-text-tertiary)] block mb-1">
            Close Date
          </label>
          <div className="relative flex flex-col gap-1 w-full">
            <Input
              type="date"
              value={loi.close_date ?? ''}
              onChange={(e) => updateLoi('close_date', e.target.value || null)}
              className={cn(
                "h-8 text-[13px] bg-[var(--color-surface-1)] border-[var(--color-surface-3)] focus:border-[var(--color-accent)] w-full transition-all",
                errors.close_date && "border-[var(--color-danger-border)] bg-[rgba(239,68,68,0.03)] animate-card-shake"
              )}
            />
            {errors.close_date && (
              <span className="text-[10px] text-[var(--color-danger-text)] font-semibold mt-0.5 leading-none">
                {errors.close_date}
              </span>
            )}
          </div>
        </div>

        {/* Outcome Selector */}
        <div className="rounded-xl border p-4 bg-[var(--color-surface-0)] border-[var(--color-surface-2)] shadow-xs">
          <label className="text-[10px] font-semibold uppercase tracking-[0.03em] text-[var(--color-text-tertiary)] block mb-1">
            LOI Outcome
          </label>
          <Select
            value={loi.outcome ?? 'in_progress'}
            onValueChange={(val) => updateLoi('outcome', val)}
          >
            <SelectTrigger className="h-8 text-[13px] bg-[var(--color-surface-1)] border-[var(--color-surface-3)] focus:border-[var(--color-accent)] w-full focus:ring-0">
              <SelectValue placeholder="In Progress" />
            </SelectTrigger>
            <SelectContent>
              {OUTCOME_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Outcome-Specific Cards */}
      {loi.outcome === 'fallen_through' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl border bg-[var(--color-danger-bg)] border-[var(--color-danger-border)] text-[var(--color-danger-text)]">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-[0.03em] block">Fallen Through Date</label>
            <div className="relative flex flex-col gap-1 w-full">
              <Input
                type="date"
                value={loi.fallen_through_date ?? ''}
                onChange={(e) => updateLoi('fallen_through_date', e.target.value || null)}
                className={cn(
                  "h-8 text-[13px] bg-[var(--color-surface-0)] border-[var(--color-danger-border)] text-[var(--color-text-primary)] transition-all",
                  errors.fallen_through_date && "border-2 focus:ring-0 animate-card-shake"
                )}
              />
              {errors.fallen_through_date && (
                <span className="text-[10px] text-[var(--color-danger-text)] font-semibold mt-0.5 leading-none">
                  {errors.fallen_through_date}
                </span>
              )}
            </div>
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

      {/* LOI Email Communication Block */}
      <div className="rounded-xl border p-5 bg-[var(--color-surface-0)] border-[var(--color-surface-2)] shadow-xs space-y-4">
        <h4 className="text-[12px] font-bold text-[var(--color-text-primary)] pb-1.5 border-b border-[var(--color-surface-2)] flex items-center gap-1.5">
          <FileText className="h-4 w-4 text-[var(--color-accent)]" />
          LOI Email Dispatch
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-[0.03em] text-[var(--color-text-secondary)]">Email for LOI</label>
            <div className="relative flex flex-col gap-1 w-full">
              <Input
                type="text"
                value={loi.loi_email ?? ''}
                onChange={(e) => updateLoi('loi_email', e.target.value || null)}
                placeholder="broker@example.com"
                className={cn(
                  "h-8 text-[13px] bg-[var(--color-surface-1)] border-[var(--color-surface-3)] focus:border-[var(--color-accent)] w-full transition-all",
                  errors.loi_email && "border-[var(--color-danger-border)] bg-[rgba(239,68,68,0.03)] animate-card-shake"
                )}
              />
              {errors.loi_email && (
                <span className="text-[10px] text-[var(--color-danger-text)] font-semibold mt-0.5 leading-none">
                  {errors.loi_email}
                </span>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-[0.03em] text-[var(--color-text-secondary)]">Last Email for LOI Sent On</label>
            <div className="h-8 px-3 rounded-md border border-[var(--color-surface-2)] bg-[var(--color-surface-1)] flex items-center text-[13px] font-mono text-[var(--color-text-secondary)] font-semibold">
              {loi.last_loi_email_sent_at ? formatDate(loi.last_loi_email_sent_at) : 'Never sent'}
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
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 p-4 rounded-xl border border-[var(--color-surface-3)] bg-[var(--color-surface-1)] mb-4 transition-all animate-tab-entrance">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-[0.03em] text-[var(--color-text-secondary)]">Party</label>
              <Select
                value={newRound.party}
                onValueChange={(val) => setNewRound((p) => ({ ...p, party: val }))}
              >
                <SelectTrigger className="h-8 text-[12px] bg-[var(--color-surface-0)] border-[var(--color-surface-3)] focus:border-[var(--color-accent)] w-full focus:ring-0">
                  <SelectValue placeholder="Party" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="buyer">Buyer (Our Side)</SelectItem>
                  <SelectItem value="seller">Seller (Broker/Owner)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-[0.03em] text-[var(--color-text-secondary)]">Price Counter</label>
              <div className="relative flex flex-col gap-1 w-full">
                <div className="relative flex items-center">
                  <DollarSign className="absolute left-2 h-3 text-[var(--color-text-tertiary)] top-1/2 -translate-y-1/2" />
                  <Input
                    type="text"
                    value={newRound.price}
                    onChange={(e) => handleNewRoundChange('price', e.target.value)}
                    className={cn(
                      "h-8 pl-6 text-[12px] font-mono bg-[var(--color-surface-0)] border-[var(--color-surface-3)] focus:border-[var(--color-accent)] w-full transition-all",
                      newRoundErrors.price && "border-[var(--color-danger-border)] bg-[rgba(239,68,68,0.03)] animate-card-shake"
                    )}
                  />
                </div>
                {newRoundErrors.price && (
                  <span className="text-[10px] text-[var(--color-danger-text)] font-semibold mt-0.5 leading-none">
                    {newRoundErrors.price}
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-[0.03em] text-[var(--color-text-secondary)]">Date</label>
              <div className="flex flex-col gap-1 w-full">
                <Input
                  type="date"
                  value={newRound.round_date}
                  onChange={(e) => handleNewRoundChange('round_date', e.target.value)}
                  className={cn(
                    "h-8 text-[12px] bg-[var(--color-surface-0)] border-[var(--color-surface-3)] focus:border-[var(--color-accent)] w-full transition-all",
                    newRoundErrors.round_date && "border-[var(--color-danger-border)] bg-[rgba(239,68,68,0.03)] animate-card-shake"
                  )}
                />
                {newRoundErrors.round_date && (
                  <span className="text-[10px] text-[var(--color-danger-text)] font-semibold mt-0.5 leading-none">
                    {newRoundErrors.round_date}
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-[10px] font-semibold uppercase tracking-[0.03em] text-[var(--color-text-secondary)]">Notes</label>
              <div className="flex gap-2">
                <Input
                  value={newRound.notes}
                  onChange={(e) => handleNewRoundChange('notes', e.target.value)}
                  placeholder="Terms, contingencies, reactions..."
                  className="h-8 text-[12px] bg-[var(--color-surface-0)] border-[var(--color-surface-3)] focus:border-[var(--color-accent)] flex-1"
                />
                <Button 
                  size="sm" 
                  onClick={submitRound} 
                  disabled={createRoundMutation.isPending || !!newRoundErrors.price || !!newRoundErrors.round_date} 
                  className="h-8 text-[11px] font-medium bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90 text-[var(--color-text-inverse)] gap-1.5"
                >
                  {createRoundMutation.isPending ? <LoadingSpinner size="sm" /> : <Plus size={12} />}
                  Add
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
                  <div className="text-[11px] text-[var(--color-text-tertiary)] font-mono font-medium inline-flex items-center gap-1 min-w-[120px]">
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
