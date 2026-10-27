import { z } from 'zod';

export const errorCodeSchema = z.enum([
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'FORBIDDEN',
  'CONFLICT',
  'INTERNAL_ERROR',
  'RATE_LIMITED',
]);

export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const validationDetailSchema = z.object({
  path: z.string(),
  message: z.string(),
});

export type ValidationDetail = z.infer<typeof validationDetailSchema>;

export const apiErrorResponseSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
    details: z.array(validationDetailSchema).optional(),
    requestId: z.string().optional(),
  }),
});

export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
