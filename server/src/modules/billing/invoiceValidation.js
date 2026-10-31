import { z } from 'zod';

export const invoiceIdSchema = z.object({ id: z.string().min(1) });

export const invoiceListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['DRAFT', 'CONFIRMED', 'PAID', 'CANCELLED']).optional(),
  customerId: z.string().min(1).optional(),
});
