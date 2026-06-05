import { z } from 'zod'

export const createTemplateSchema = z.object({
  project_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  subject_template: z.string().max(500).optional(),
  body_template: z.string().max(50000).optional(),
})

export const patchTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  subject_template: z.string().max(500).optional(),
  body_template: z.string().max(50000).optional(),
})
