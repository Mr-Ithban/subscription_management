import { z } from 'zod';

export const PAYMENT_METHODS = ['CASH', 'CARD', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'ONLINE'];

export const recordPaymentSchema = z.object({
  method: z.enum(PAYMENT_METHODS, {
    errorMap: (issue, ctx) => {
      if (issue.code === 'invalid_enum_value') {
        return { message: `Invalid payment method. Must be one of: ${PAYMENT_METHODS.join(', ')}` };
      }
      return { message: ctx.defaultError };
    },
  }),
  amount: z
    .number({
      required_error: 'Payment amount is required',
      invalid_type_error: 'Payment amount must be a number',
    })
    .int('Payment amount must be an integer (in smallest currency unit)')
    .positive('Payment amount must be a positive integer'),
  paidAt: z.coerce
    .date({
      invalid_type_error: 'paidAt must be a valid date',
    })
    .optional(),
  note: z.string().trim().max(500, 'Note cannot exceed 500 characters').optional(),
});

export const listPaymentsQuerySchema = z.object({
  invoiceId: z.string().trim().optional(),
  method: z.enum(PAYMENT_METHODS).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const invoiceParamSchema = z.object({
  id: z.string().trim().min(1, 'Invoice ID is required'),
});

export const outstandingQuerySchema = z.object({
  customerId: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const overdueQuerySchema = z.object({
  customerId: z.string().trim().optional(),
  asOf: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});
