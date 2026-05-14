import { z } from 'zod'

export const createContactSchema = z.object({
  deal_id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  company: z.string().max(255).optional(),
  title: z.string().max(255).optional(),
  email: z.array(z.string().email()).min(1, 'At least one email required'),
  phone_office: z.string().max(30).optional(),
  phone_cell: z.string().max(30).optional(),
  is_primary: z.boolean().default(false),
})

export const patchContactSchema = createContactSchema.partial().omit({ deal_id: true })
