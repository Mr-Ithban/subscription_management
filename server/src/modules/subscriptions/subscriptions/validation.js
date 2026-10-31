import { z } from 'zod';

const lineSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1).nullable().optional(),
  taxId: z.string().min(1).nullable().optional(),
  quantity: z.number().int().positive(),
});

export const createSubscriptionSchema = z.object({
  customerId: z.string().min(1),
  planId: z.string().min(1),
  startDate: z.coerce.date(),
  expiryDate: z.coerce.date().nullable().optional(),
  paymentTerms: z.number().int().nonnegative().default(0),
  lines: z.array(lineSchema).default([]),
}).refine((data) => !data.expiryDate || data.expiryDate >= data.startDate, {
  message: 'Expiry date must be on or after the start date', path: ['expiryDate'],
});

export const updateSubscriptionSchema = z.object({
  customerId: z.string().min(1).optional(),
  planId: z.string().min(1).optional(),
  startDate: z.coerce.date().optional(),
  expiryDate: z.coerce.date().nullable().optional(),
  paymentTerms: z.number().int().nonnegative().optional(),
  lines: z.array(lineSchema).optional(),
}).refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' })
  .refine((data) => !data.startDate || !data.expiryDate || data.expiryDate >= data.startDate, {
    message: 'Expiry date must be on or after the start date', path: ['expiryDate'],
  });

export const subscriptionIdSchema = z.object({ id: z.string().min(1) });

export const transitionBodySchema = z.object({
  note: z.string().trim().max(500).optional(),
}).default({});

export const listSubscriptionsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['DRAFT', 'QUOTATION', 'CONFIRMED', 'ACTIVE', 'CLOSED']).optional(),
  customerId: z.string().min(1).optional(),
});
