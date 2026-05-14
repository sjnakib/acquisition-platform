import * as z from 'zod';

export const importSchema = z.object({
  property_id: z.string().optional(),
  deal_name: z.string().optional(),
  property_type: z.enum(['multifamily', 'retail', 'office', 'industrial', 'mixed_use', 'other']).optional(),
  building_class: z.enum(['A', 'B', 'C', 'D', 'unclassified']).optional(),
  year_built: z.number().int().optional(),
  year_renovated: z.number().int().optional(),
  unit_count: z.number().int().optional(),
  property_link: z.string().url().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  contacts: z.array(z.object({
    name: z.string().optional(),
    company: z.string().optional(),
    title: z.string().optional(),
    email: z.array(z.string().email()).optional(),
    phone_office: z.string().optional(),
    phone_cell: z.string().optional(),
    is_primary: z.boolean().optional(),
  })).optional(),
});

export const importBatchSchema = z.array(importSchema);
