'use client'

import { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Save, Lock, ArrowUpRight, TrendingUp, DollarSign, Percent, Award, CheckCircle2, AlertTriangle, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { useDeal } from '@/lib/hooks/useDeal'

interface UnderwritingData {
  underwritability_status?: string | null
  asking_price?: number | null
  price_per_unit?: number | null
  purchase_price?: number | null
  purchase_price_per_unit?: number | null
  capex?: number | null
  capex_per_unit?: number | null
  occupancy_pct?: number | null
  irr_pct?: number | null
  equity_multiple?: number | null
  cash_on_cash_pct?: number | null
  profit?: number | null
  proceed_with_loi?: boolean | null
  uw_notes?: string | null
}

interface Props {
  dealId: string
  unitCount: number | null
}

export function UnderwritingSummary({ dealId, unitCount }: Props) {
  const queryClient = useQueryClient()
  const [dirty, setDirty] = useState(false)

  const { data: deal, isLoading } = useDeal<{ underwriting?: Record<string, unknown> }>(dealId)

  // ── Local form state (initialized from deal cache, editable) ────────────
  const [formData, setFormData] = useState<UnderwritingData | null>(null)
  const [formDealId, setFormDealId] = useState<string | null>(null)

  // Initialize form data from deal cache (render-phase, no useEffect needed)
  if (deal && formDealId !== dealId) {
    setFormData((deal.underwriting ?? {}) as UnderwritingData)
    setFormDealId(dealId)
    setDirty(false)
  }

  const update = useCallback((field: string, value: string | number | boolean | null) => {
    setFormData((prev) => {
      if (!prev) return prev
      const next = { ...prev, [field]: value === '' ? null : value }
      
      // Auto-compute price per unit and capex per unit inline as user types
      if (unitCount && unitCount > 0) {
        if (field === 'purchase_price' && typeof value === 'number') {
          next.purchase_price_per_unit = Math.round(value / unitCount)
        }
        if (field === 'capex' && typeof value === 'number') {
          next.capex_per_unit = Math.round(value / unitCount)
        }
      }
      return next
    })
    setDirty(true)
  }, [unitCount])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!formData) throw new Error('No data')
      const res = await fetch('/api/underwriting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deal_id: dealId,
          purchase_price: formData.purchase_price,
          purchase_price_per_unit: formData.purchase_price_per_unit,
          capex: formData.capex,
          capex_per_unit: formData.capex_per_unit,
          occupancy_pct: formData.occupancy_pct,
          irr_pct: formData.irr_pct,
          equity_multiple: formData.equity_multiple,
          cash_on_cash_pct: formData.cash_on_cash_pct,
          profit: formData.profit,
          proceed_with_loi: formData.proceed_with_loi,
          uw_notes: formData.uw_notes,
        }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Failed to save')
      }
    },
    onSuccess: () => {
      setDirty(false)
      queryClient.invalidateQueries({ queryKey: ['deal', dealId] })
      queryClient.invalidateQueries({ queryKey: ['deals'] })
      toast.success('Underwriting saved')
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to save underwriting'),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <LoadingSpinner size="md" />
      </div>
    )
  }

  const fmtCurrency = (v: number | null | undefined) => 
    v != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v) : '—'
  
  const fmtPct = (v: number | null | undefined) => 
    v != null ? `${Number(v).toFixed(2)}%` : '—'

  function numberField(
    label: string, 
    field: keyof UnderwritingData, 
    options?: { readOnly?: boolean; suffix?: string; format?: (v: number | null | undefined) => string; placeholder?: string }
  ) {
    const val = formData?.[field]
    const isReadOnly = options?.readOnly
    return (
      <div className="space-y-1.5">
        <label className="text-[10px] font-semibold uppercase tracking-[0.03em] flex items-center gap-1 text-[var(--color-text-secondary)]">
          {label}
          {isReadOnly && <Lock size={10} className="text-[var(--color-text-tertiary)]" />}
        </label>
        {isReadOnly ? (
          <div className="h-9 px-3 rounded-lg border border-[var(--color-surface-2)] bg-[var(--color-surface-1)] flex items-center text-[13px] font-mono font-semibold text-[var(--color-text-secondary)]">
            {options?.format ? options.format(val as number | null | undefined) : String(val ?? '—')}
          </div>
        ) : (
          <div className="relative flex items-center">
            <Input
              type="number"
              value={val != null ? String(val) : ''}
              onChange={(e) => update(field, e.target.value === '' ? null : Number(e.target.value))}
              placeholder={options?.placeholder ?? '—'}
              className="h-9 text-[13px] font-mono bg-[var(--color-surface-1)] border-[var(--color-surface-3)] focus:border-[var(--color-accent)] pr-8"
            />
            {options?.suffix && (
              <span className="absolute right-3 text-[11px] font-mono font-medium text-[var(--color-text-tertiary)]">
                {options.suffix}
              </span>
            )}
          </div>
        )}
      </div>
    )
  }

  // Calculate pricing discount delta if asking price is available
  const asking = formData?.asking_price
  const purchase = formData?.purchase_price
  const pricingDelta = asking && purchase ? ((purchase - asking) / asking) * 100 : null

  return (
    <div className="space-y-6">
      {/* Tab Header with Actions */}
      <div className="flex items-center justify-between pb-3 border-b border-[var(--color-surface-2)]">
        <div>
          <h3 className="text-[14px] font-bold text-[var(--color-text-primary)]">
            Underwriting & Financials
          </h3>
          <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">
            Model purchase terms, CapEx allocations, and evaluate returns prior to LOI generation.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {dirty && (
            <Button 
              size="sm" 
              onClick={() => saveMutation.mutate()} 
              disabled={saveMutation.isPending} 
              className="bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90 text-[var(--color-text-inverse)] h-8 px-3 text-[12px] font-medium shadow-xs gap-1.5"
            >
              {saveMutation.isPending ? <LoadingSpinner size="sm" /> : <Save size={13} />}
              Save Model
            </Button>
          )}
        </div>
      </div>

      {/* Return Dashboard Deck */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* IRR */}
        <div className="rounded-xl border p-4 bg-[var(--color-surface-0)] border-[var(--color-surface-2)] shadow-xs relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-16 h-16 bg-[rgba(30,91,63,0.03)] rounded-bl-full flex items-center justify-center pointer-events-none transition-all group-hover:scale-110">
            <Percent className="h-5 w-5 text-[var(--color-accent)] opacity-40 translate-x-2 -translate-y-2" />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.03em] text-[var(--color-text-tertiary)] block">
            Projected IRR
          </span>
          <div className="flex items-baseline gap-1.5 mt-2">
            <span className="text-xl font-bold font-mono text-[var(--color-text-primary)]">
              {formData?.irr_pct != null ? `${formData.irr_pct}%` : '—'}
            </span>
            {formData?.irr_pct != null && (
              <span className="text-[10px] font-medium text-[var(--color-success-text)] inline-flex items-center">
                <ArrowUpRight size={10} className="mr-0.5" /> Target
              </span>
            )}
          </div>
        </div>

        {/* Cash-on-Cash */}
        <div className="rounded-xl border p-4 bg-[var(--color-surface-0)] border-[var(--color-surface-2)] shadow-xs relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-16 h-16 bg-[rgba(59,130,246,0.03)] rounded-bl-full flex items-center justify-center pointer-events-none transition-all group-hover:scale-110">
            <TrendingUp className="h-5 w-5 text-blue-500 opacity-40 translate-x-2 -translate-y-2" />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.03em] text-[var(--color-text-tertiary)] block">
            Cash-on-Cash Return
          </span>
          <div className="flex items-baseline mt-2">
            <span className="text-xl font-bold font-mono text-[var(--color-text-primary)]">
              {formData?.cash_on_cash_pct != null ? `${formData.cash_on_cash_pct}%` : '—'}
            </span>
          </div>
        </div>

        {/* Equity Multiple */}
        <div className="rounded-xl border p-4 bg-[var(--color-surface-0)] border-[var(--color-surface-2)] shadow-xs relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-16 h-16 bg-[rgba(245,158,11,0.03)] rounded-bl-full flex items-center justify-center pointer-events-none transition-all group-hover:scale-110">
            <Award className="h-5 w-5 text-amber-500 opacity-40 translate-x-2 -translate-y-2" />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.03em] text-[var(--color-text-tertiary)] block">
            Equity Multiple (EM)
          </span>
          <div className="flex items-baseline mt-2">
            <span className="text-xl font-bold font-mono text-[var(--color-text-primary)]">
              {formData?.equity_multiple != null ? `${Number(formData.equity_multiple).toFixed(2)}x` : '—'}
            </span>
          </div>
        </div>

        {/* Profit */}
        <div className="rounded-xl border p-4 bg-[var(--color-surface-0)] border-[var(--color-surface-2)] shadow-xs relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-16 h-16 bg-[rgba(16,185,129,0.03)] rounded-bl-full flex items-center justify-center pointer-events-none transition-all group-hover:scale-110">
            <DollarSign className="h-5 w-5 text-emerald-500 opacity-40 translate-x-2 -translate-y-2" />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.03em] text-[var(--color-text-tertiary)] block">
            Projected Profit
          </span>
          <div className="flex items-baseline mt-2">
            <span className="text-xl font-bold font-mono text-[var(--color-text-primary)]">
              {formData?.profit != null ? fmtCurrency(formData.profit) : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Form Split */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left/Middle: Financial Inputs */}
        <div className="md:col-span-2 space-y-6">
          {/* Section 1: Acquisition & Cost Modeling */}
          <div className="rounded-xl border p-5 bg-[var(--color-surface-0)] border-[var(--color-surface-2)] shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-[var(--color-surface-2)] pb-2">
              <DollarSign className="h-4 w-4 text-[var(--color-accent)]" />
              <h4 className="text-[12px] font-bold text-[var(--color-text-primary)]">
                Acquisition & Capital Structure
              </h4>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {numberField('Purchase Price', 'purchase_price', { placeholder: 'e.g. 15000000' })}
              {numberField('Purchase Price / Unit', 'purchase_price_per_unit', { readOnly: true, format: fmtCurrency })}
              {numberField('CAPEX Allocation', 'capex', { placeholder: 'e.g. 1200000' })}
              {numberField('CAPEX / Unit', 'capex_per_unit', { readOnly: true, format: fmtCurrency })}
              <div className="col-span-2">
                {numberField('Target Occupancy', 'occupancy_pct', { suffix: '%', placeholder: 'e.g. 95' })}
              </div>
            </div>

            {/* Purchase vs Asking Price Analysis */}
            {asking && purchase && (
              <div className="rounded-lg p-3 border border-[var(--color-surface-3)] bg-[var(--color-surface-1)] text-[12px] space-y-2 mt-2">
                <div className="flex justify-between font-semibold">
                  <span style={{ color: 'var(--color-text-secondary)' }}>Pricing vs Asking Delta</span>
                  <span className={pricingDelta && pricingDelta <= 0 ? 'text-[var(--color-success-text)] font-mono' : 'text-[var(--color-danger-text)] font-mono'}>
                    {pricingDelta != null ? `${pricingDelta > 0 ? '+' : ''}${pricingDelta.toFixed(2)}%` : '—'}
                  </span>
                </div>
                <div className="w-full bg-[var(--color-surface-3)] h-1.5 rounded-full overflow-hidden flex">
                  {pricingDelta && pricingDelta < 0 ? (
                    <>
                      <div className="bg-[var(--color-accent)] h-full transition-all" style={{ width: `${Math.max(20, 100 + pricingDelta)}%` }} />
                      <div className="bg-[var(--color-success-border)] h-full transition-all flex-1" />
                    </>
                  ) : (
                    <div className="bg-[var(--color-accent)] h-full w-full" />
                  )}
                </div>
                <p className="text-[10px] text-[var(--color-text-tertiary)]">
                  Asking Price: <span className="font-mono font-semibold">{fmtCurrency(asking)}</span> (or <span className="font-mono">{fmtCurrency(formData?.price_per_unit)}/unit</span>). 
                  Purchase price represents a <span className="font-semibold font-mono">{fmtCurrency(Math.abs(asking - purchase))}</span> {purchase < asking ? 'discount' : 'premium'}.
                </p>
              </div>
            )}
          </div>

          {/* Section 2: Returns & Yield Projections */}
          <div className="rounded-xl border p-5 bg-[var(--color-surface-0)] border-[var(--color-surface-2)] shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-[var(--color-surface-2)] pb-2">
              <TrendingUp className="h-4 w-4 text-[var(--color-accent)]" />
              <h4 className="text-[12px] font-bold text-[var(--color-text-primary)]">
                Projected Yields & Returns
              </h4>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {numberField('Target IRR', 'irr_pct', { suffix: '%', placeholder: 'e.g. 16.5' })}
              {numberField('Equity Multiple (EM)', 'equity_multiple', { suffix: 'x', placeholder: 'e.g. 1.85' })}
              {numberField('Cash-on-Cash Return', 'cash_on_cash_pct', { suffix: '%', placeholder: 'e.g. 8.2' })}
              {numberField('Projected Net Profit', 'profit', { placeholder: 'e.g. 3200000' })}
            </div>
          </div>
        </div>

        {/* Right side: Underwriting Decision & Notes */}
        <div className="space-y-6 flex flex-col">
          {/* Proceed with LOI Selector Card */}
          <div className="rounded-xl border p-5 bg-[var(--color-surface-0)] border-[var(--color-surface-2)] shadow-xs flex-1 flex flex-col">
            <h4 className="text-[12px] font-bold text-[var(--color-text-primary)] mb-3 pb-2 border-b border-[var(--color-surface-2)]">
              LOI Recommendation
            </h4>

            <div className="space-y-3 flex-1 flex flex-col justify-center">
              {/* Option A: Yes, Proceed */}
              <button
                type="button"
                onClick={() => update('proceed_with_loi', true)}
                className={`w-full text-left p-3.5 rounded-xl border-2 transition-all flex items-start gap-3 relative group ${
                  formData?.proceed_with_loi === true
                    ? 'border-[var(--color-success-border)] bg-[var(--color-success-bg)] shadow-xs'
                    : 'border-[var(--color-surface-2)] bg-transparent hover:border-[var(--color-surface-3)]'
                }`}
              >
                <div className={`mt-0.5 rounded-full p-0.5 flex-shrink-0 border ${
                  formData?.proceed_with_loi === true
                    ? 'bg-[var(--color-success-border)] text-white border-transparent'
                    : 'bg-transparent text-transparent border-[var(--color-surface-3)] group-hover:border-[var(--color-text-tertiary)]'
                }`}>
                  <CheckCircle2 size={14} className="fill-current" />
                </div>
                <div>
                  <span className={`text-xs font-bold block ${
                    formData?.proceed_with_loi === true ? 'text-[var(--color-success-text)]' : 'text-[var(--color-text-primary)]'
                  }`}>
                    Proceed to LOI
                  </span>
                  <span className="text-[10px] text-[var(--color-text-tertiary)] block mt-0.5 leading-normal">
                    Analyst recommendation is solid. Move deal forward to draft Letter of Intent.
                  </span>
                </div>
              </button>

              {/* Option B: Hold / No */}
              <button
                type="button"
                onClick={() => update('proceed_with_loi', false)}
                className={`w-full text-left p-3.5 rounded-xl border-2 transition-all flex items-start gap-3 relative group ${
                  formData?.proceed_with_loi === false
                    ? 'border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] shadow-xs'
                    : 'border-[var(--color-surface-2)] bg-transparent hover:border-[var(--color-surface-3)]'
                }`}
              >
                <div className={`mt-0.5 rounded-full p-0.5 flex-shrink-0 border ${
                  formData?.proceed_with_loi === false
                    ? 'bg-[var(--color-danger-border)] text-white border-transparent'
                    : 'bg-transparent text-transparent border-[var(--color-surface-3)] group-hover:border-[var(--color-text-tertiary)]'
                }`}>
                  <AlertTriangle size={14} className="fill-current" />
                </div>
                <div>
                  <span className={`text-xs font-bold block ${
                    formData?.proceed_with_loi === false ? 'text-[var(--color-danger-text)]' : 'text-[var(--color-text-primary)]'
                  }`}>
                    Hold Deal in Screening
                  </span>
                  <span className="text-[10px] text-[var(--color-text-tertiary)] block mt-0.5 leading-normal">
                    Underwriting return thresholds not met. Flag for further diligence or pricing renegotiation.
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Underwriting Notes */}
          <div className="rounded-xl border p-5 bg-[var(--color-surface-0)] border-[var(--color-surface-2)] shadow-xs">
            <h4 className="text-[12px] font-bold text-[var(--color-text-primary)] mb-3 pb-2 border-b border-[var(--color-surface-2)] flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Model Notes & Assumptions
            </h4>
            <textarea
              value={formData?.uw_notes ?? ''}
              onChange={(e) => update('uw_notes', e.target.value)}
              placeholder="Underwriting notes, assumptions, or key findings..."
              rows={4}
              className="w-full text-[13px] bg-[var(--color-surface-1)] border border-[var(--color-surface-3)] rounded-lg px-3 py-2.5 focus:border-[var(--color-accent)] focus:ring-0 outline-none resize-none placeholder-[var(--color-text-tertiary)] text-[var(--color-text-primary)]"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

