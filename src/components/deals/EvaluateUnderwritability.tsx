'use client'

import { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Save } from 'lucide-react'
import { toast } from 'sonner'
import { useDeal } from '@/lib/hooks/useDeal'

interface UnderwritingData {
  underwritability_status?: string | null
  asking_price?: number | null
  price_per_unit?: number | null
  population_1mi?: number | null
  population_growth_pct?: number | null
  rent_growth_12mo_pct?: number | null
  rent_growth_forecast_pct?: number | null
  vacancy_rate_pct?: number | null
  market_price_per_unit?: number | null
  delta_pct?: number | null
  cap_rate?: number | null
  sale_rent_comps?: string | null
}

interface Props {
  dealId: string
  unitCount: number | null
}

const STATUS_OPTIONS = [
  { value: '', label: 'Not evaluated' },
  { value: 'go', label: 'Go / Underwritable' },
  { value: 'no_go', label: 'No-Go / Not Underwritable' },
  { value: 'maybe', label: 'Maybe' },
]

export function EvaluateUnderwritability({ dealId, unitCount }: Props) {
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

  const update = useCallback((field: string, value: string | number | null) => {
    setFormData((prev) => prev ? { ...prev, [field]: value === '' ? null : value } : prev)
    setDirty(true)
  }, [])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!formData) throw new Error('No data')
      const res = await fetch('/api/underwriting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deal_id: dealId,
          underwritability_status: formData.underwritability_status,
          asking_price: formData.asking_price,
          price_per_unit: formData.price_per_unit,
          population_1mi: formData.population_1mi,
          population_growth_pct: formData.population_growth_pct,
          rent_growth_12mo_pct: formData.rent_growth_12mo_pct,
          rent_growth_forecast_pct: formData.rent_growth_forecast_pct,
          vacancy_rate_pct: formData.vacancy_rate_pct,
          market_price_per_unit: formData.market_price_per_unit,
          delta_pct: formData.delta_pct,
          cap_rate: formData.cap_rate,
          sale_rent_comps: formData.sale_rent_comps,
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
      toast.success('Evaluation saved')
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to save evaluation'),
  })

  const autoComputePricePerUnit = useCallback((askingPrice: number) => {
    if (unitCount && unitCount > 0) {
      setFormData((prev) => prev ? { ...prev, price_per_unit: Math.round(askingPrice / unitCount) } : prev)
    }
  }, [unitCount])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <LoadingSpinner size="md" />
      </div>
    )
  }

  function numberField(label: string, field: keyof UnderwritingData, suffix?: string) {
    const val = formData?.[field]
    return (
      <div className="space-y-1">
        <label className="text-[11px] font-medium uppercase tracking-[0.03em]" style={{ color: 'var(--color-text-tertiary)' }}>
          {label}
        </label>
        <Input
          type="number"
          value={val != null ? String(val) : ''}
          onChange={(e) => {
            const v = e.target.value === '' ? null : Number(e.target.value)
            update(field, v)
            if (field === 'asking_price' && v) autoComputePricePerUnit(v)
          }}
          placeholder="—"
          className="h-8 text-[13px] font-mono bg-[var(--color-surface-1)] border-[var(--color-surface-3)] focus:border-[var(--color-accent)]"
        />
        {suffix && (
          <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>{suffix}</span>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Evaluate Underwritability
          </h3>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
            Initial screening metrics for deal evaluation
          </p>
        </div>
        {dirty && (
          <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="bg-[var(--color-accent)] border-none text-[var(--color-text-inverse)] h-8 text-[12px]">
            <Save size={13} />
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        {numberField('Asking Price', 'asking_price', 'total')}
        {numberField('Price / Unit', 'price_per_unit')}
        {numberField('Population (1-Mile)', 'population_1mi')}
        {numberField('Population Growth %', 'population_growth_pct', '%')}
        {numberField('Rent Growth % (12 Mo)', 'rent_growth_12mo_pct', '%')}
        {numberField('Rent Growth % (Forecast)', 'rent_growth_forecast_pct', '%')}
        {numberField('Vacancy Rate %', 'vacancy_rate_pct', '%')}
        {numberField('Market Price / Unit', 'market_price_per_unit')}
        {numberField('Delta % (Market vs Subject)', 'delta_pct', '%')}
        {numberField('Cap Rate', 'cap_rate', '%')}
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-medium uppercase tracking-[0.03em]" style={{ color: 'var(--color-text-tertiary)' }}>
          Underwritable?
        </label>
        <select
          value={formData?.underwritability_status ?? ''}
          onChange={(e) => { update('underwritability_status', e.target.value || null); setDirty(true) }}
          className="h-8 text-[13px] bg-[var(--color-surface-1)] border border-[var(--color-surface-3)] rounded-md px-2 w-full focus:border-[var(--color-accent)] outline-none"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-medium uppercase tracking-[0.03em]" style={{ color: 'var(--color-text-tertiary)' }}>
          Sale & Rent Comps
        </label>
        <textarea
          value={formData?.sale_rent_comps ?? ''}
          onChange={(e) => { update('sale_rent_comps', e.target.value); setDirty(true) }}
          placeholder="Notes on sale and rent comparables..."
          rows={3}
          className="w-full text-[13px] bg-[var(--color-surface-1)] border border-[var(--color-surface-3)] rounded-md px-3 py-2 focus:border-[var(--color-accent)] outline-none resize-none"
          style={{ color: 'var(--color-text-primary)' }}
        />
      </div>
    </div>
  )
}
