import { z } from 'zod'

export const createDealSchema = z.object({
  project_id: z.string().uuid().optional(),
  campaign_id: z.string().uuid(),
  portfolio_id: z.string().uuid().optional().nullable(),
  outreach_emails: z.array(z.string().email()).default([]),
})

export const patchDealSchema = z.object({
  campaign_id: z.string().uuid().optional(),
  portfolio_id: z.string().uuid().optional().nullable(),
  outreach_emails: z.array(z.string().email()).optional(),
  stage: z.enum([
    'lead', 'outreach', 'response', 'underwriting',
    'loi', 'closed', 'failed', 'archived',
  ]).optional(),
  score: z.enum(['very_good', 'good', 'bad', 'very_bad']).optional().nullable(),
  is_archived: z.boolean().optional(),
  archive_reason: z.string().max(500).optional().nullable(),
  internal_notes: z.string().max(10000).optional().nullable(),
  drive_folder_url: z.string().url().optional().nullable(),
  last_email_sent_on: z.string().datetime().optional().nullable(),
  response_type: z.string().max(100).optional().nullable(),
  last_contacted_at: z.string().datetime().optional().nullable(),
})

export const dynamicFieldPatchSchema = z.record(z.string(), z.union([
  z.string(), z.number(), z.boolean(), z.null(),
]))
