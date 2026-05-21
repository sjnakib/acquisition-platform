import { z } from 'zod'

export const createCampaignSchema = z.object({
  project_id: z.string().uuid().optional(),
  name: z.string().min(1).max(255),
  market: z.string().min(1).max(255),
  listing_type: z.enum(['on_market', 'off_market']).optional(),
  email_template: z.enum(['outreach', 'thank_you', 'declination']).optional(),
  email_subject_template: z.string().max(500).optional(),
  target_response_rate_pct: z.number().min(0).max(100).optional().nullable(),
  target_loi_count: z.number().int().min(0).optional().nullable(),
  is_active: z.boolean().optional(),
})

export const patchCampaignSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  market: z.string().min(1).max(255).optional(),
  listing_type: z.enum(['on_market', 'off_market']).optional().nullable(),
  email_template: z.enum(['outreach', 'thank_you', 'declination']).optional().nullable(),
  email_subject_template: z.string().max(500).optional().nullable(),
  target_response_rate_pct: z.number().min(0).max(100).optional().nullable(),
  target_loi_count: z.number().int().min(0).optional().nullable(),
  is_active: z.boolean().optional(),
})
