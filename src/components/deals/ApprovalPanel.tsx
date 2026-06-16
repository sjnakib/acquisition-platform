'use client'

import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'

interface Profile {
  id: string
  full_name: string | null
}

interface ApprovalPanelProps {
  loiRecommendation: boolean | null
  uwAnalystId: string | null
  uwCompletionDate: string | null
  reviewer1Id: string | null
  review1Date: string | null
  reviewer2Id: string | null
  review2Date: string | null
  profiles: Profile[]
  onChange: (data: Record<string, unknown>) => void
}

export function ApprovalPanel({
  loiRecommendation, uwAnalystId, uwCompletionDate,
  reviewer1Id, review1Date, reviewer2Id, review2Date,
  profiles, onChange,
}: ApprovalPanelProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-[15px] font-medium" style={{ color: 'var(--color-text-primary)' }}>Approval & Review Tracking</h3>

      <div className="flex items-center justify-between">
        <label className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>LOI Recommendation</label>
        <Switch
          checked={loiRecommendation === true}
          onCheckedChange={(v) => onChange({ loi_recommendation: v })}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>UW Analyst</label>
          <Select value={uwAnalystId ?? 'none'} onValueChange={(v) => onChange({ uw_analyst_id: v === 'none' ? null : v })}>
            <SelectTrigger className="h-[34px] text-[13px]">
              <SelectValue placeholder="Select analyst..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>UW Completion Date</label>
          <Input
            type="date"
            className="h-[34px] text-[13px]"
            value={uwCompletionDate ?? ''}
            onChange={(e) => onChange({ uw_completion_date: e.target.value || null })}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>Reviewer 1</label>
          <Select value={reviewer1Id ?? 'none'} onValueChange={(v) => onChange({ reviewer_1_id: v === 'none' ? null : v })}>
            <SelectTrigger className="h-[34px] text-[13px]">
              <SelectValue placeholder="Select reviewer..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>Review 1 Date</label>
          <Input
            type="date"
            className="h-[34px] text-[13px]"
            value={review1Date ?? ''}
            onChange={(e) => onChange({ review_1_date: e.target.value || null })}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>Reviewer 2</label>
          <Select value={reviewer2Id ?? 'none'} onValueChange={(v) => onChange({ reviewer_2_id: v === 'none' ? null : v })}>
            <SelectTrigger className="h-[34px] text-[13px]">
              <SelectValue placeholder="Select reviewer..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>Review 2 Date</label>
          <Input
            type="date"
            className="h-[34px] text-[13px]"
            value={review2Date ?? ''}
            onChange={(e) => onChange({ review_2_date: e.target.value || null })}
          />
        </div>
      </div>
    </div>
  )
}
