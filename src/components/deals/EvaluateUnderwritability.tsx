'use client'

import { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Save } from 'lucide-react'
import { toast } from 'sonner'
import { useDeal } from '@/lib/hooks/useDeal'
import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface UnderwritingData {
  underwritability_status?: string | null
  asking_price?: number | string | null
  price_per_unit?: number | string | null
  population_1mi?: number | string | null
  population_growth_pct?: number | string | null
  rent_growth_12mo_pct?: number | string | null
  rent_growth_forecast_pct?: number | string | null
  vacancy_rate_pct?: number | string | null
  market_price_per_unit?: number | string | null
  delta_pct?: number | string | null
  cap_rate?: number | string | null
}

interface Props {
  dealId: string
  unitCount: number | null
}

export function EvaluateUnderwritability({ dealId, unitCount }: Props) {
  const queryClient = useQueryClient()
  const [dirty, setDirty] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: deal, isLoading } = useDeal<{ underwriting?: Record<string, unknown> }>(dealId)

  // ── Local form state (initialized from deal cache, editable) ────────────
  const [formData, setFormData] = useState<UnderwritingData | null>(null)
  const [formDealId, setFormDealId] = useState<string | null>(null)

  // Initialize form data from deal cache (render-phase, no useEffect needed)
  if (deal && formDealId !== dealId) {
    setFormData((deal.underwriting ?? {}) as UnderwritingData)
    setFormDealId(dealId)
    setDirty(false)
    setErrors({})
  }

  const validateField = useCallback((field: string, rawVal: string): string | null => {
    const trimmed = rawVal.trim()
    if (trimmed === '') return null // Empty/null is valid (clearing)

    if (field === 'underwritability_status') return null

    const val = Number(trimmed)
    if (isNaN(val)) return 'Must be a valid number'

    // Positive numeric checks
    if (['asking_price', 'price_per_unit', 'market_price_per_unit', 'cap_rate'].includes(field)) {
      if (val < 0) return 'Must be a non-negative amount'
    }

    // Positive integer check
    if (field === 'population_1mi') {
      if (val < 0) return 'Must be a non-negative count'
      if (!Number.isInteger(val)) return 'Must be a whole number'
    }

    // Percentage check
    if (field === 'vacancy_rate_pct') {
      if (val < 0 || val > 100) return 'Must be between 0% and 100%'
    }

    return null
  }, [])

  const update = useCallback((field: string, value: string) => {
    setFormData((prev) => prev ? { ...prev, [field]: value === '' ? null : value } : prev)
    setDirty(true)

    const err = validateField(field, value)
    setErrors((prev) => ({ ...prev, [field]: err ?? '' }))
  }, [validateField])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!formData) throw new Error('No data')
      
      const parsedData = {
        deal_id: dealId,
        underwritability_status: formData.underwritability_status === 'none' || !formData.underwritability_status ? null : formData.underwritability_status,
        asking_price: formData.asking_price != null ? Number(formData.asking_price) : null,
        price_per_unit: formData.price_per_unit != null ? Number(formData.price_per_unit) : null,
        population_1mi: formData.population_1mi != null ? Number(formData.population_1mi) : null,
        population_growth_pct: formData.population_growth_pct != null ? Number(formData.population_growth_pct) : null,
        rent_growth_12mo_pct: formData.rent_growth_12mo_pct != null ? Number(formData.rent_growth_12mo_pct) : null,
        rent_growth_forecast_pct: formData.rent_growth_forecast_pct != null ? Number(formData.rent_growth_forecast_pct) : null,
        vacancy_rate_pct: formData.vacancy_rate_pct != null ? Number(formData.vacancy_rate_pct) : null,
        market_price_per_unit: formData.market_price_per_unit != null ? Number(formData.market_price_per_unit) : null,
        delta_pct: formData.delta_pct != null ? Number(formData.delta_pct) : null,
        cap_rate: formData.cap_rate != null ? Number(formData.cap_rate) : null,
      }

      const res = await fetch('/api/underwriting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsedData),
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
      toast.success('Evaluation saved')
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to save evaluation'),
  })

  const autoComputePricePerUnit = useCallback((askingPrice: number) => {
    if (unitCount && unitCount > 0) {
      setFormData((prev) => {
        if (!prev) return prev
        const pricePerUnit = Math.round(askingPrice / unitCount)
        const marketPrice = prev.market_price_per_unit ? Number(prev.market_price_per_unit) : null
        const delta = (marketPrice && marketPrice !== 0)
          ? Number((((pricePerUnit - marketPrice) / marketPrice) * 100).toFixed(3))
          : prev.delta_pct
        return { ...prev, price_per_unit: pricePerUnit, delta_pct: delta }
      })
    }
  }, [unitCount])

  const autoComputeDelta = useCallback((marketPrice: number | null) => {
    if (!marketPrice) return
    setFormData((prev) => {
      if (!prev) return prev
      const pricePerUnit = prev.price_per_unit ? Number(prev.price_per_unit) : null
      const delta = (pricePerUnit && marketPrice !== 0)
        ? Number((((pricePerUnit - marketPrice) / marketPrice) * 100).toFixed(3))
        : prev.delta_pct
      return { ...prev, delta_pct: delta }
    })
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <LoadingSpinner size="md" />
      </div>
    )
  }

  const hasErrors = Object.values(errors).some(Boolean)

  function numberField(label: string, field: keyof UnderwritingData, opts?: { suffix?: string; readOnly?: boolean }) {
    const val = formData?.[field]
    const isReadOnly = opts?.readOnly
    const err = errors[field]
    const hasError = !!err

    return (
      <div className="space-y-1">
        <label className="text-[11px] font-medium uppercase tracking-[0.03em]" style={{ color: 'var(--color-text-secondary)' }}>
          {label}
        </label>
        {isReadOnly ? (
          <div className="h-8 px-3 rounded-md border border-[var(--color-surface-2)] bg-[var(--color-surface-1)] flex items-center text-[13px] font-mono font-semibold text-[var(--color-text-secondary)]">
            {val != null ? (opts?.suffix ? `${val}${opts.suffix}` : String(val)) : '—'}
          </div>
        ) : (
          <div className="relative flex flex-col gap-1 w-full">
            <Input
              type="text"
              value={val != null ? String(val) : ''}
              onChange={(e) => {
                const rawVal = e.target.value
                update(field, rawVal)
                
                const v = rawVal === '' ? null : Number(rawVal)
                if (v !== null && !isNaN(v) && v >= 0) {
                  if (field === 'asking_price') autoComputePricePerUnit(v)
                  if (field === 'market_price_per_unit') autoComputeDelta(v)
                  if (field === 'price_per_unit') autoComputeDelta(formData?.market_price_per_unit ? Number(formData.market_price_per_unit) : null)
                }
              }}
              placeholder="—"
              className={cn(
                "h-8 text-[13px] font-mono bg-[var(--color-surface-1)] border-[var(--color-surface-3)] focus:border-[var(--color-accent)] transition-all",
                hasError && "border-[var(--color-danger-border)] focus:border-[var(--color-danger-border)] focus:ring-1 focus:ring-[var(--color-danger-border)] bg-[rgba(239,68,68,0.03)] animate-card-shake"
              )}
            />
            {err && (
              <span className="text-[10px] text-[var(--color-danger-text)] font-semibold mt-0.5 leading-none animate-tab-entrance">
                {err}
              </span>
            )}
          </div>
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
          <Button 
            size="sm" 
            onClick={() => saveMutation.mutate()} 
            disabled={saveMutation.isPending || hasErrors} 
            className="bg-[var(--color-accent)] border-none text-[var(--color-text-inverse)] h-8 text-[12px] gap-1.5"
          >
            {saveMutation.isPending ? <LoadingSpinner size="sm" /> : <Save size={13} />}
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        {numberField('Asking Price', 'asking_price', { suffix: 'total' })}
        {numberField('Price / Unit', 'price_per_unit')}
        {numberField('Population (1-Mile)', 'population_1mi')}
        {numberField('Population Growth %', 'population_growth_pct', { suffix: '%' })}
        {numberField('Rent Growth % (12 Mo)', 'rent_growth_12mo_pct', { suffix: '%' })}
        {numberField('Rent Growth % (Forecast)', 'rent_growth_forecast_pct', { suffix: '%' })}
        {numberField('Vacancy Rate %', 'vacancy_rate_pct', { suffix: '%' })}
        {numberField('Market Price / Unit', 'market_price_per_unit')}
        {numberField('Delta % (Market vs Subject)', 'delta_pct', { suffix: '%', readOnly: true })}
        {numberField('Cap Rate', 'cap_rate', { suffix: '%' })}
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-medium uppercase tracking-[0.03em]" style={{ color: 'var(--color-text-secondary)' }}>
          Underwritable?
        </label>
        <Select
          value={formData?.underwritability_status ?? 'none'}
          onValueChange={(val) => {
            update('underwritability_status', val === 'none' ? '' : val)
          }}
        >
          <SelectTrigger className="h-8 text-[13px] bg-[var(--color-surface-1)] border-[var(--color-surface-3)] focus:border-[var(--color-accent)] w-full focus:ring-0">
            <SelectValue placeholder="Not evaluated" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Not evaluated</SelectItem>
            <SelectItem value="go">Go / Underwritable</SelectItem>
            <SelectItem value="no_go">No-Go / Not Underwritable</SelectItem>
            <SelectItem value="maybe">Maybe</SelectItem>
          </SelectContent>
        </Select>
      </div>

    </div>
  )
}
