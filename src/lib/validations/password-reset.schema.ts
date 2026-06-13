import { z } from 'zod'

export const requestResetSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase()),
  turnstileToken: z.string().min(1, 'Please complete the bot check'),
})

export const executeResetSchema = z
  .object({
    password: z.string().min(8).max(128),
    confirmPassword: z.string(),
    turnstileToken: z.string().min(1, 'Please complete the bot check'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type RequestResetInput = z.infer<typeof requestResetSchema>
export type ExecuteResetInput = z.infer<typeof executeResetSchema>
