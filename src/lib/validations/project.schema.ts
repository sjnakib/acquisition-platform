import { z } from 'zod'

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(2000).optional(),
})

export const patchProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
})

export const addSponsorSchema = z.object({
  email: z.string().email('Valid email is required'),
  full_name: z.string().min(1).max(255).optional(),
})

export const createProjectFormSchema = createProjectSchema.extend({
  sponsors: z.array(z.object({
    email: z.string().email('Valid email is required'),
    full_name: z.string().min(1).max(255).optional(),
  })).optional(),
})

export const duplicateProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
})
