import { z } from 'zod'

export const createPortfolioSchema = z.object({
  project_id: z.string().uuid().optional(),
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
})

export const deletePortfolioSchema = z.object({
  mode: z.enum(['orphan', 'archive']),
})
