import { z } from 'zod'

export const importSchema = z.object({
  campaign_id: z.string().uuid(),
  file: z.instanceof(File).refine((f) => f.size <= 10 * 1024 * 1024, 'File exceeds 10MB limit'),
})
