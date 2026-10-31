import { z } from 'zod';

export const productTypeEnum = z.enum(['SERVICE', 'GOODS', 'SOFTWARE'], {
  errorMap: () => ({ message: 'Product type must be SERVICE, GOODS, or SOFTWARE' }),
});

export const createProductSchema = z.object({
  name: z.string({ required_error: 'Product name is required' }).trim().min(1, 'Product name is required'),
  type: productTypeEnum,
  salesPrice: z
    .number({ required_error: 'Sales price is required', invalid_type_error: 'Sales price must be an integer' })
    .int('Sales price must be an integer')
    .nonnegative('Sales price cannot be negative'),
  costPrice: z
    .number({ required_error: 'Cost price is required', invalid_type_error: 'Cost price must be an integer' })
    .int('Cost price must be an integer')
    .nonnegative('Cost price cannot be negative'),
  notes: z.string().optional().nullable(),
  active: z.boolean().optional().default(true),
});

export const updateProductSchema = z.object({
  name: z.string().trim().min(1, 'Product name cannot be empty').optional(),
  type: productTypeEnum.optional(),
  salesPrice: z
    .number({ invalid_type_error: 'Sales price must be an integer' })
    .int('Sales price must be an integer')
    .nonnegative('Sales price cannot be negative')
    .optional(),
  costPrice: z
    .number({ invalid_type_error: 'Cost price must be an integer' })
    .int('Cost price must be an integer')
    .nonnegative('Cost price cannot be negative')
    .optional(),
  notes: z.string().optional().nullable(),
  active: z.boolean().optional(),
});

export const createVariantSchema = z.object({
  attribute: z.string({ required_error: 'Attribute is required' }).trim().min(1, 'Attribute is required'),
  value: z.string({ required_error: 'Value is required' }).trim().min(1, 'Value is required'),
  extraPrice: z
    .number({ required_error: 'Extra price is required', invalid_type_error: 'Extra price must be an integer' })
    .int('Extra price must be an integer')
    .nonnegative('Extra price cannot be negative'),
});

export const updateVariantSchema = z.object({
  attribute: z.string().trim().min(1, 'Attribute cannot be empty').optional(),
  value: z.string().trim().min(1, 'Value cannot be empty').optional(),
  extraPrice: z
    .number({ invalid_type_error: 'Extra price must be an integer' })
    .int('Extra price must be an integer')
    .nonnegative('Extra price cannot be negative')
    .optional(),
});
