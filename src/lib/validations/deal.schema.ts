import { z } from 'zod'

const CURRENT_YEAR = new Date().getFullYear()

export const createDealSchema = z.object({
  campaign_id: z.string().uuid(),
  deal_name: z.string().min(1).max(255),
  source: z.enum(['direct', 'indirect']),
  listing_type: z.enum(['on_market', 'off_market']).optional(),
  property_type: z.enum(['multifamily','retail','office','industrial','mixed_use','other']).optional(),
  building_class: z.enum(['A','B','C','D','unclassified']).optional(),
  year_built: z.number().int().min(1800).max(CURRENT_YEAR).optional().nullable(),
  unit_count: z.number().int().min(1).optional().nullable(),
  address: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  state: z.string().length(2).toUpperCase().optional(),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/).optional(),
})

export const patchDealSchema = createDealSchema.partial().extend({
  stage: z.enum([
    'lead','outreach','response','document_collection',
    'underwritability_review','underwriting','scored','call_scheduled',
    'loi','closed','archived'
  ]).optional(),
  score: z.enum(['very_good','good','bad','very_bad']).optional().nullable(),
  is_archived: z.boolean().optional(),
  archive_reason: z.string().max(500).optional().nullable(),
  internal_notes: z.string().max(10000).optional().nullable(),
  drive_folder_url: z.string().url().optional().nullable(),
})
