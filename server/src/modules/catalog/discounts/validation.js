import { z } from 'zod';

export const discountTypeEnum = z.enum(['FIXED', 'PERCENT'], {
  errorMap: () => ({ message: 'Discount type must be FIXED or PERCENT' }),
});

export const discountAppliesToEnum = z.enum(['PRODUCT', 'SUBSCRIPTION'], {
  errorMap: () => ({ message: 'appliesTo must be PRODUCT or SUBSCRIPTION' }),
});

export const createDiscountSchema = z
  .object({
    name: z
      .string({ required_error: 'Discount name is required' })
      .trim()
      .min(1, 'Discount name is required'),
    type: discountTypeEnum,
    value: z
      .number({
        required_error: 'Discount value is required',
        invalid_type_error: 'Discount value must be an integer',
      })
      .int('Discount value must be an integer')
      .positive('Discount value must be greater than 0'),
    minPurchase: z
      .number({ invalid_type_error: 'minPurchase must be an integer' })
      .int('minPurchase must be an integer')
      .nonnegative('minPurchase cannot be negative')
      .optional()
      .nullable(),
    minQty: z
      .number({ invalid_type_error: 'minQty must be an integer' })
      .int('minQty must be an integer')
      .min(1, 'minQty must be at least 1')
      .optional()
      .nullable(),
    startDate: z.coerce.date({
      required_error: 'Start date is required',
      invalid_type_error: 'Invalid start date',
    }),
    endDate: z.coerce.date({
      required_error: 'End date is required',
      invalid_type_error: 'Invalid end date',
    }),
    usageLimit: z
      .number({ invalid_type_error: 'usageLimit must be an integer' })
      .int('usageLimit must be an integer')
      .min(1, 'usageLimit must be at least 1')
      .optional()
      .nullable(),
    appliesTo: discountAppliesToEnum,
    productId: z.string().trim().optional().nullable(),
    active: z.boolean().optional().default(true),
  })
  .refine(
    (data) => {
      if (data.type === 'PERCENT') {
        return data.value >= 1 && data.value <= 100;
      }
      return true;
    },
    {
      message: 'PERCENT discount value must be between 1 and 100',
      path: ['value'],
    }
  )
  .refine(
    (data) => new Date(data.endDate) > new Date(data.startDate),
    {
      message: 'End date must be after start date',
      path: ['endDate'],
    }
  )
  .refine(
    (data) => {
      if (data.appliesTo === 'PRODUCT') {
        return Boolean(data.productId && data.productId.trim().length > 0);
      }
      return true;
    },
    {
      message: 'Product ID is required when appliesTo is PRODUCT',
      path: ['productId'],
    }
  )
  .refine(
    (data) => {
      if (data.appliesTo === 'SUBSCRIPTION') {
        return !data.productId;
      }
      return true;
    },
    {
      message: 'Product ID must not be set when appliesTo is SUBSCRIPTION',
      path: ['productId'],
    }
  );

export const updateDiscountSchema = z
  .object({
    name: z.string().trim().min(1, 'Discount name cannot be empty').optional(),
    type: discountTypeEnum.optional(),
    value: z
      .number({ invalid_type_error: 'Discount value must be an integer' })
      .int('Discount value must be an integer')
      .positive('Discount value must be greater than 0')
      .optional(),
    minPurchase: z
      .number({ invalid_type_error: 'minPurchase must be an integer' })
      .int('minPurchase must be an integer')
      .nonnegative('minPurchase cannot be negative')
      .optional()
      .nullable(),
    minQty: z
      .number({ invalid_type_error: 'minQty must be an integer' })
      .int('minQty must be an integer')
      .min(1, 'minQty must be at least 1')
      .optional()
      .nullable(),
    startDate: z.coerce.date({ invalid_type_error: 'Invalid start date' }).optional(),
    endDate: z.coerce.date({ invalid_type_error: 'Invalid end date' }).optional(),
    usageLimit: z
      .number({ invalid_type_error: 'usageLimit must be an integer' })
      .int('usageLimit must be an integer')
      .min(1, 'usageLimit must be at least 1')
      .optional()
      .nullable(),
    appliesTo: discountAppliesToEnum.optional(),
    productId: z.string().trim().optional().nullable(),
    active: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.type === 'PERCENT' && data.value !== undefined) {
        return data.value >= 1 && data.value <= 100;
      }
      return true;
    },
    {
      message: 'PERCENT discount value must be between 1 and 100',
      path: ['value'],
    }
  )
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.endDate) > new Date(data.startDate);
      }
      return true;
    },
    {
      message: 'End date must be after start date',
      path: ['endDate'],
    }
  )
  .refine(
    (data) => {
      if (data.appliesTo === 'PRODUCT' && data.productId !== undefined) {
        return Boolean(data.productId && data.productId.trim().length > 0);
      }
      return true;
    },
    {
      message: 'Product ID is required when appliesTo is PRODUCT',
      path: ['productId'],
    }
  )
  .refine(
    (data) => {
      if (data.appliesTo === 'SUBSCRIPTION' && data.productId) {
        return false;
      }
      return true;
    },
    {
      message: 'Product ID must not be set when appliesTo is SUBSCRIPTION',
      path: ['productId'],
    }
  );
