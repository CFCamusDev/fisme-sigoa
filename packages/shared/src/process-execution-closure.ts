import { z } from 'zod';
import { processExecutionStatusSchema } from './process-executions.js';

export const VOID_REASON_MAX_LENGTH = 500;

export const closeProcessExecutionRequestSchema = z.object({}).strict();

export type CloseProcessExecutionRequest = z.infer<typeof closeProcessExecutionRequestSchema>;

export const closeProcessExecutionResponseSchema = z
  .object({
    executionId: z.string(),
    previousStatus: processExecutionStatusSchema,
    status: z.literal('CLOSED'),
    updatedAt: z.string(),
  })
  .strict();

export type CloseProcessExecutionResponse = z.infer<typeof closeProcessExecutionResponseSchema>;

export const voidProcessExecutionRequestSchema = z
  .object({
    reason: z
      .string({ message: 'Ingresa el motivo de anulación' })
      .trim()
      .min(1, 'Ingresa el motivo de anulación')
      .max(
        VOID_REASON_MAX_LENGTH,
        `El motivo no puede superar ${VOID_REASON_MAX_LENGTH} caracteres`,
      ),
  })
  .strict();

export type VoidProcessExecutionRequest = z.infer<typeof voidProcessExecutionRequestSchema>;

export const voidProcessExecutionResponseSchema = z
  .object({
    executionId: z.string(),
    previousStatus: processExecutionStatusSchema,
    status: z.literal('VOIDED'),
    voidReason: z.string().min(1).max(VOID_REASON_MAX_LENGTH),
    updatedAt: z.string(),
  })
  .strict();

export type VoidProcessExecutionResponse = z.infer<typeof voidProcessExecutionResponseSchema>;
