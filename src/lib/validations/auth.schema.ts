import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  turnstileToken: z.string().min(1, 'Please complete the bot check'),
})

export const signupSchema = loginSchema.extend({
  fullName: z.string().min(2).max(100),
  role: z.enum(['internal', 'client', 'admin']).default('internal'),
})
