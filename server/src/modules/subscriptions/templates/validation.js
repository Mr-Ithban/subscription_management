import { z } from 'zod';

const lineSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1).nullable().optional(),
  taxId: z.string().min(1).nullable().optional(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().int().nonnegative(),
});

export const createTemplateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  validityDays: z.number().int().positive(),
  planId: z.string().min(1),
  lines: z.array(lineSchema).default([]),
});

export const updateTemplateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  validityDays: z.number().int().positive().optional(),
  planId: z.string().min(1).optional(),
  lines: z.array(lineSchema).optional(),
}).refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

export const templateIdSchema = z.object({ id: z.string().min(1) });

export const createSubscriptionFromTemplateSchema = z.object({
  customerId: z.string().min(1),
  startDate: z.coerce.date(),
  expiryDate: z.coerce.date().nullable().optional(),
  paymentTerms: z.number().int().nonnegative().default(0),
}).refine((data) => !data.expiryDate || data.expiryDate >= data.startDate, {
  message: 'Expiry date must be on or after the start date', path: ['expiryDate'],
});
