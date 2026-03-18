import { z } from 'zod';

export const numericIdSchema = z.string().regex(/^[1-9]\d*$/, 'Invalid numeric id');
export const optionalNumericIdSchema = numericIdSchema.optional();
