import { z } from 'zod';
import { processExecutionStatusSchema } from './process-executions.js';

export const EXECUTION_PRECONDITION_CODES = [
  'SCHEDULE_HAS_ACTIVITY',
  'SESSIONS_SURVEYS_CLOSED',
  'SESSIONS_MINUTES_SIGNED',
  'MEASUREMENTS_REVIEWED',
  'CONSOLIDATION_MINUTES_SIGNED',
  'RESULTS_CALCULATED',
  'IMPROVEMENT_ACTIONS_REGISTERED',
  'RESOLUTION_APPROVED',
] as const;

export type ExecutionPreconditionCodeValue = (typeof EXECUTION_PRECONDITION_CODES)[number];

export const PRECONDITION_STATES = ['MET', 'UNMET', 'NOT_VERIFIABLE'] as const;

export type PreconditionStateValue = (typeof PRECONDITION_STATES)[number];

export const executionPreconditionCodeSchema = z.enum(EXECUTION_PRECONDITION_CODES, {
  message: 'Código de precondición no válido',
});

export const preconditionStateSchema = z.enum(PRECONDITION_STATES, {
  message: 'El estado de la precondición debe ser MET, UNMET o NOT_VERIFIABLE',
});

export const executionPreconditionResultSchema = z
  .object({
    code: executionPreconditionCodeSchema,
    label: z.string().min(1),
    state: preconditionStateSchema,
  })
  .strict();

export type ExecutionPreconditionResultDto = z.infer<typeof executionPreconditionResultSchema>;

export const advanceProcessExecutionRequestSchema = z.object({}).strict();

export type AdvanceProcessExecutionRequest = z.infer<typeof advanceProcessExecutionRequestSchema>;

export const advanceProcessExecutionResponseSchema = z
  .object({
    executionId: z.string(),
    previousStatus: processExecutionStatusSchema,
    status: processExecutionStatusSchema,
    updatedAt: z.string(),
  })
  .strict();

export type AdvanceProcessExecutionResponse = z.infer<typeof advanceProcessExecutionResponseSchema>;

export const nextTransitionResponseSchema = z
  .object({
    executionId: z.string(),
    status: processExecutionStatusSchema,
    nextStatus: processExecutionStatusSchema.nullable(),
    preconditions: z.array(executionPreconditionResultSchema),
    canAdvance: z.boolean(),
  })
  .strict();

export type NextTransitionResponse = z.infer<typeof nextTransitionResponseSchema>;
