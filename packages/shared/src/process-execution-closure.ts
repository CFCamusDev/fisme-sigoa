import { z } from 'zod';
import { processExecutionStatusSchema } from './process-executions.js';
import { STAKEHOLDER_VOID_REASON_MIN_LENGTH } from './stakeholders.js';

export const VOID_REASON_MIN_LENGTH = STAKEHOLDER_VOID_REASON_MIN_LENGTH;
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
      .min(
        VOID_REASON_MIN_LENGTH,
        `El motivo debe tener al menos ${VOID_REASON_MIN_LENGTH} caracteres`,
      )
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
