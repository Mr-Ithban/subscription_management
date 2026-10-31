import { z } from 'zod';

export const summaryQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  skipCache: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => val === 'true'),
});

export const revenueQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  groupBy: z.enum(['day', 'week', 'month']).default('month'),
});

export const subscriptionsQuerySchema = z.object({
  status: z.enum(['DRAFT', 'QUOTATION', 'CONFIRMED', 'ACTIVE', 'CLOSED']).optional(),
  planId: z.string().optional(),
  customerId: z.string().optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const overdueQuerySchema = z.object({
  customerId: z.string().optional(),
  asOf: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});
