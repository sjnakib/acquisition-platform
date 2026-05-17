import { z } from 'zod'

const columnActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('system'), field: z.literal('deal_name') }),
  z.object({ action: z.literal('email_target') }),
  z.object({ action: z.literal('unit_count') }),
  z.object({ action: z.literal('field'), key: z.string().min(1) }),
  z.object({
    action: z.literal('new_field'),
    key: z.string().min(1).regex(/^[a-z0-9_]+$/, 'lowercase, digits, underscores only'),
    label: z.string().min(1),
    dataType: z.enum(['text', 'number', 'integer', 'date', 'boolean', 'url', 'currency']),
  }),
  z.object({ action: z.literal('drop') }),
])

export const mappingSchema = z.object({
  mapping: z.record(z.string(), columnActionSchema),
})

export type ColumnActionInput = z.infer<typeof columnActionSchema>
