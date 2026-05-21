'use client'

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { z } from 'zod'
import { createCampaignSchema } from '@/lib/validations/campaign.schema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type FormValues = z.infer<typeof createCampaignSchema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId?: string
}

export function CreateCampaignDialog({ open, onOpenChange, projectId }: Props) {
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const queryClient = useQueryClient()

  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(createCampaignSchema),
    defaultValues: { is_active: true },
  })

  const onSubmit = async (data: FormValues) => {
    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, project_id: projectId }),
    })
    if (!res.ok) {
      const err = await res.json()
      toast.error(err.error ?? 'Failed to create campaign')
      return
    }
    queryClient.invalidateQueries({ queryKey: ['campaigns', projectId] })
    toast.success('Campaign created')
    reset()
    setAdvancedOpen(false)
    onOpenChange(false)
  }

  const handleClose = () => {
    reset()
    setAdvancedOpen(false)
    onOpenChange(false)
  }

  const s = {
    label: { fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' } as const,
    hint: { fontSize: 12, color: 'var(--color-text-tertiary)' } as const,
    error: { fontSize: 12, color: 'var(--color-danger-text)' } as const,
    field: { marginBottom: 16 } as const,
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Create Campaign</DialogTitle>
          <DialogDescription style={{ color: 'var(--color-text-secondary)' }}>
            Set up a new outreach campaign to organize your deals.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Name */}
          <div>
            <Label htmlFor="name" style={s.label}>Name</Label>
            <Input id="name" {...register('name')} placeholder="e.g. Q2 Industrial Outreach" className="mt-1" />
            {errors.name && <p style={s.error}>{errors.name.message}</p>}
          </div>

          {/* Market */}
          <div>
            <Label htmlFor="market" style={s.label}>Market</Label>
            <Input id="market" {...register('market')} placeholder="e.g. Dallas-Fort Worth" className="mt-1" />
            {errors.market && <p style={s.error}>{errors.market.message}</p>}
          </div>

          {/* Listing type + Active */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="listing_type" style={s.label}>Listing Type</Label>
              <Controller
                name="listing_type"
                control={control}
                render={({ field }) => (
                  <Select value={field.value ?? ''} onValueChange={(v) => field.onChange(v || undefined)}>
                    <SelectTrigger id="listing_type" className="mt-1">
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="on_market">On Market</SelectItem>
                      <SelectItem value="off_market">Off Market</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="flex items-end pb-1">
              <div className="flex items-center gap-2">
                <Controller
                  name="is_active"
                  control={control}
                  render={({ field }) => (
                    <Switch id="is_active" checked={field.value} onCheckedChange={field.onChange} />
                  )}
                />
                <Label htmlFor="is_active" style={s.label}>Active</Label>
              </div>
            </div>
          </div>

          {/* Advanced toggle */}
          <button
            type="button"
            onClick={() => setAdvancedOpen(!advancedOpen)}
            className="flex items-center gap-1 text-[13px] font-medium transition-colors hover:opacity-80"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {advancedOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            Advanced Settings
          </button>

          {advancedOpen && (
            <div className="space-y-4 pl-1">
              {/* Email template */}
              <div>
                <Label htmlFor="email_template" style={s.label}>Email Template</Label>
                <Controller
                  name="email_template"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value ?? ''} onValueChange={(v) => field.onChange(v || undefined)}>
                      <SelectTrigger id="email_template" className="mt-1">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="outreach">Outreach</SelectItem>
                        <SelectItem value="thank_you">Thank You</SelectItem>
                        <SelectItem value="declination">Declination</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              {/* Email subject template */}
              <div>
                <Label htmlFor="email_subject_template" style={s.label}>
                  Email Subject Template
                </Label>
                <Input
                  id="email_subject_template"
                  {...register('email_subject_template')}
                  placeholder="e.g. {property_address} — Investment Opportunity"
                  className="mt-1"
                />
                <p style={s.hint}>Use {'{property_address}'} as a placeholder.</p>
              </div>

              {/* Targets */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="target_response_rate_pct" style={s.label}>
                    Target Response Rate (%)
                  </Label>
                  <Input
                    id="target_response_rate_pct"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    {...register('target_response_rate_pct', { valueAsNumber: true })}
                    placeholder="e.g. 15"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="target_loi_count" style={s.label}>
                    Target LOI Count
                  </Label>
                  <Input
                    id="target_loi_count"
                    type="number"
                    min="0"
                    {...register('target_loi_count', { valueAsNumber: true })}
                    placeholder="e.g. 2"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Campaign'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
