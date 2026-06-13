import { z } from 'zod'

export const createInvitationSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase()),
  role: z.enum(['internal', 'client', 'admin']),
  projectIds: z.array(z.string().uuid()).default([]),
  expiresInHours: z.number().int().min(1).max(720).default(48),
  message: z.string().max(500).optional(),
})

export const acceptInvitationSchema = z.object({
  token: z.string().uuid(),
  name: z.string().min(1).max(100),
  password: z.string().min(8).max(128),
  turnstileToken: z.string().min(1, 'Please complete the bot check'),
})

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>
