import { z } from 'zod'

export const createCallBriefSchema = z.object({
  deal_id: z.string().uuid(),
  contact_name: z.string().min(1).max(200),
  contact_role: z.string().max(200).optional(),
  phone_number: z.string().max(50).optional(),
  summary_text: z.string().min(1).max(2000),
})

export const updateCallBriefSchema = z.object({
  contact_name: z.string().min(1).max(200).optional(),
  contact_role: z.string().max(200).optional(),
  phone_number: z.string().max(50).optional(),
  summary_text: z.string().min(1).max(2000).optional(),
  published: z.boolean().optional(),
  call_status: z.enum(['pending', 'completed', 'cancelled']).optional(),
})
