import { z } from 'zod';

export const billingPeriodEnum = z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'], {
  errorMap: () => ({ message: 'Billing period must be DAILY, WEEKLY, MONTHLY, or YEARLY' }),
});

export const planStatusEnum = z.enum(['ACTIVE', 'PAUSED', 'CLOSED'], {
  errorMap: () => ({ message: 'Plan status must be ACTIVE, PAUSED, or CLOSED' }),
});

export const createPlanSchema = z
  .object({
    name: z.string({ required_error: 'Plan name is required' }).trim().min(1, 'Plan name is required'),
    price: z
      .number({ required_error: 'Price is required', invalid_type_error: 'Price must be an integer' })
      .int('Price must be an integer')
      .nonnegative('Price cannot be negative'),
    billingPeriod: billingPeriodEnum,
    minQty: z
      .number({ invalid_type_error: 'Minimum quantity must be an integer' })
      .int('Minimum quantity must be an integer')
      .min(1, 'Minimum quantity must be at least 1')
      .optional()
      .default(1),
    startDate: z.coerce.date({ required_error: 'Start date is required', invalid_type_error: 'Invalid start date' }),
    endDate: z.coerce.date({ invalid_type_error: 'Invalid end date' }).optional().nullable(),
    status: planStatusEnum.optional().default('ACTIVE'),
    autoClose: z.boolean().optional().default(false),
    allowPause: z.boolean().optional().default(true),
    allowEarlyClose: z.boolean().optional().default(true),
    allowRenew: z.boolean().optional().default(true),
    productId: z.string().trim().optional().nullable(),
  })
  .refine(
    (data) => {
      if (!data.endDate || !data.startDate) return true;
      return new Date(data.endDate) > new Date(data.startDate);
    },
    {
      message: 'End date must be after start date',
      path: ['endDate'],
    }
  );

export const updatePlanSchema = z
  .object({
    name: z.string().trim().min(1, 'Plan name cannot be empty').optional(),
    price: z
      .number({ invalid_type_error: 'Price must be an integer' })
      .int('Price must be an integer')
      .nonnegative('Price cannot be negative')
      .optional(),
    billingPeriod: billingPeriodEnum.optional(),
    minQty: z
      .number({ invalid_type_error: 'Minimum quantity must be an integer' })
      .int('Minimum quantity must be an integer')
      .min(1, 'Minimum quantity must be at least 1')
      .optional(),
    startDate: z.coerce.date({ invalid_type_error: 'Invalid start date' }).optional(),
    endDate: z.coerce.date({ invalid_type_error: 'Invalid end date' }).optional().nullable(),
    status: planStatusEnum.optional(),
    autoClose: z.boolean().optional(),
    allowPause: z.boolean().optional(),
    allowEarlyClose: z.boolean().optional(),
    allowRenew: z.boolean().optional(),
    productId: z.string().trim().optional().nullable(),
  })
  .refine(
    (data) => {
      if (!data.endDate || !data.startDate) return true;
      return new Date(data.endDate) > new Date(data.startDate);
    },
    {
      message: 'End date must be after start date',
      path: ['endDate'],
    }
  );
