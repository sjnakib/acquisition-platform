import { z } from 'zod'

export const createActivitySchema = z.object({
  deal_id: z.string().uuid(),
  type: z.enum(['call', 'voicemail', 'note', 'meeting', 'other']),
  summary: z.string().min(1).max(2000),
})
