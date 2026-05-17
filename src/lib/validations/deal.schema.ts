import { z } from 'zod'

export const createDealSchema = z.object({
  campaign_id: z.string().uuid(),
  portfolio_id: z.string().uuid().optional().nullable(),
  deal_name: z.string().min(1).max(255),
  outreach_emails: z.array(z.string().email()).default([]),
  unit_count: z.number().int().min(1).optional().nullable(),
})

export const patchDealSchema = z.object({
  campaign_id: z.string().uuid().optional(),
  portfolio_id: z.string().uuid().optional().nullable(),
  deal_name: z.string().min(1).max(255).optional(),
  outreach_emails: z.array(z.string().email()).optional(),
  unit_count: z.number().int().min(1).optional().nullable(),
  stage: z.enum([
    'lead', 'outreach', 'response', 'underwriting',
    'loi', 'closed', 'failed', 'archived',
  ]).optional(),
  score: z.enum(['very_good', 'good', 'bad', 'very_bad']).optional().nullable(),
  is_archived: z.boolean().optional(),
  archive_reason: z.string().max(500).optional().nullable(),
  internal_notes: z.string().max(10000).optional().nullable(),
  drive_folder_url: z.string().url().optional().nullable(),
})

export const dynamicFieldPatchSchema = z.record(z.string(), z.union([
  z.string(), z.number(), z.boolean(), z.null(),
]))
