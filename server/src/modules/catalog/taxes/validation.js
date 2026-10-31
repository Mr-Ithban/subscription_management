import { z } from 'zod';

export const createTaxSchema = z.object({
  name: z
    .string({ required_error: 'Tax name is required' })
    .trim()
    .min(1, 'Tax name is required'),
  rate: z
    .number({
      required_error: 'Tax rate is required',
      invalid_type_error: 'Tax rate must be a number',
    })
    .min(0, 'Tax rate cannot be negative')
    .max(100, 'Tax rate cannot exceed 100'),
  active: z.boolean().optional().default(true),
});

export const updateTaxSchema = z.object({
  name: z.string().trim().min(1, 'Tax name cannot be empty').optional(),
  rate: z
    .number({ invalid_type_error: 'Tax rate must be a number' })
    .min(0, 'Tax rate cannot be negative')
    .max(100, 'Tax rate cannot exceed 100')
    .optional(),
  active: z.boolean().optional(),
});
