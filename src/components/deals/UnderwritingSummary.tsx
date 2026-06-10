'use client'

import { useState, useEffect, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Save, Lock } from 'lucide-react'
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
  const [data, setData] = useState<UnderwritingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dirty, setDirty] = useState(false)

  const { data: deal } = useDeal<{ underwriting?: Record<string, unknown> }>(dealId)

  useEffect(() => {
    if (!deal) return
    const t = setTimeout(() => {
      setData(deal.underwriting ?? {})
      setLoading(false)
    }, 0)
    return () => clearTimeout(t)
  }, [deal])

  const update = useCallback((field: string, value: string | number | boolean | null) => {
    setData((prev) => prev ? { ...prev, [field]: value === '' ? null : value } : prev)
    setDirty(true)
  }, [])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!data) throw new Error('No data')
      const res = await fetch('/api/underwriting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deal_id: dealId,
          purchase_price: data.purchase_price,
          purchase_price_per_unit: data.purchase_price_per_unit,
          capex: data.capex,
          capex_per_unit: data.capex_per_unit,
          occupancy_pct: data.occupancy_pct,
          irr_pct: data.irr_pct,
          equity_multiple: data.equity_multiple,
          cash_on_cash_pct: data.cash_on_cash_pct,
          profit: data.profit,
          proceed_with_loi: data.proceed_with_loi,
          uw_notes: data.uw_notes,
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
      toast.success('Underwriting saved')
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to save underwriting'),
  })

  const save = useCallback(() => {
    if (!data) return
    saveMutation.mutate()
  }, [data, saveMutation])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <LoadingSpinner size="md" />
      </div>
    )
  }

  const fmt = (v: number | null | undefined) => v != null ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v) : '—'
  const fmtPct = (v: number | null | undefined) => v != null ? `${(v * 100).toFixed(2)}%` : '—'
  const fmtCurrency = (v: number | null | undefined) => v != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v) : '—'

  function numberField(label: string, field: keyof UnderwritingData, options?: { readOnly?: boolean; suffix?: string; format?: (v: number | null | undefined) => string }) {
    const val = data?.[field]
    const isReadOnly = options?.readOnly
    return (
      <div className="space-y-1">
        <label className="text-[11px] font-medium uppercase tracking-[0.03em] flex items-center gap-1" style={{ color: 'var(--color-text-tertiary)' }}>
          {label}
          {isReadOnly && <Lock size={10} />}
        </label>
        {isReadOnly ? (
          <div className="h-8 flex items-center text-[13px] font-mono font-medium" style={{ color: 'var(--color-text-primary)' }}>
            {options?.format ? options.format(val as number | null | undefined) : String(val ?? '—')}
          </div>
        ) : (
          <Input
            type="number"
            value={val != null ? String(val) : ''}
            onChange={(e) => update(field, e.target.value === '' ? null : Number(e.target.value))}
            placeholder="—"
            className="h-8 text-[13px] font-mono bg-[var(--color-surface-1)] border-[var(--color-surface-3)] focus:border-[var(--color-accent)]"
          />
        )}
        {options?.suffix && (
          <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>{options.suffix}</span>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Underwriting Summary
          </h3>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
            Financial analysis and return projections
          </p>
        </div>
        {dirty && (
          <Button size="sm" onClick={save} disabled={saveMutation.isPending} className="bg-[var(--color-accent)] border-none text-[var(--color-text-inverse)] h-8 text-[12px]">
            <Save size={13} />
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        )}
      </div>

      <div className="border-b pb-4 mb-4" style={{ borderColor: 'var(--color-surface-2)' }}>
        <p className="text-[11px] font-medium uppercase tracking-[0.03em] mb-3" style={{ color: 'var(--color-text-tertiary)' }}>
          Screening Data <span className="font-normal normal-case tracking-normal">(from Evaluate Underwritability)</span>
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
          {numberField('Asking Price', 'asking_price', { readOnly: true, format: fmtCurrency })}
          {numberField('Price / Unit', 'price_per_unit', { readOnly: true, format: fmtCurrency })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        {numberField('Purchase Price', 'purchase_price', { format: fmtCurrency })}
        {numberField('Purchase Price / Unit', 'purchase_price_per_unit', { format: fmtCurrency })}
        {numberField('CAPEX', 'capex', { format: fmtCurrency })}
        {numberField('CAPEX / Unit', 'capex_per_unit', { format: fmtCurrency })}
        {numberField('Occupancy %', 'occupancy_pct', { suffix: '%' })}
        {numberField('IRR %', 'irr_pct', { suffix: '%' })}
        {numberField('Equity Multiple (EM)', 'equity_multiple', { format: (v) => v != null ? Number(v).toFixed(2) : '—' })}
        {numberField('Cash-on-Cash %', 'cash_on_cash_pct', { suffix: '%' })}
        {numberField('Profit', 'profit', { format: fmtCurrency })}
      </div>

      <div className="space-y-1 pt-2">
        <label className="text-[11px] font-medium uppercase tracking-[0.03em]" style={{ color: 'var(--color-text-tertiary)' }}>
          Proceed with LOI?
        </label>
        <div className="flex items-center gap-3">
          <button
            onClick={() => update('proceed_with_loi', true)}
            className={`h-8 px-4 text-[13px] font-medium rounded-md border transition-colors ${
              data?.proceed_with_loi === true
                ? 'bg-[var(--color-success-bg)] border-[var(--color-success-border)] text-[var(--color-success-text)]'
                : 'bg-[var(--color-surface-1)] border-[var(--color-surface-3)]'
            }`}
            style={{ color: data?.proceed_with_loi === true ? 'var(--color-success-text)' : 'var(--color-text-secondary)' }}
          >
            Yes, Proceed
          </button>
          <button
            onClick={() => update('proceed_with_loi', false)}
            className={`h-8 px-4 text-[13px] font-medium rounded-md border transition-colors ${
              data?.proceed_with_loi === false
                ? 'bg-[var(--color-danger-bg)] border-[var(--color-danger-border)] text-[var(--color-danger-text)]'
                : 'bg-[var(--color-surface-1)] border-[var(--color-surface-3)]'
            }`}
            style={{ color: data?.proceed_with_loi === false ? 'var(--color-danger-text)' : 'var(--color-text-secondary)' }}
          >
            No, Hold
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-medium uppercase tracking-[0.03em]" style={{ color: 'var(--color-text-tertiary)' }}>
          UW Notes
        </label>
        <textarea
          value={data?.uw_notes ?? ''}
          onChange={(e) => update('uw_notes', e.target.value)}
          placeholder="Underwriting notes, assumptions, or key findings..."
          rows={3}
          className="w-full text-[13px] bg-[var(--color-surface-1)] border border-[var(--color-surface-3)] rounded-md px-3 py-2 focus:border-[var(--color-accent)] outline-none resize-none"
          style={{ color: 'var(--color-text-primary)' }}
        />
      </div>
    </div>
  )
}
