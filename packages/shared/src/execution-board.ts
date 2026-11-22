import { z } from 'zod';
import { executionPreconditionCodeSchema } from './process-execution-transitions.js';
import { processExecutionDtoSchema, processExecutionStatusSchema } from './process-executions.js';
import { sessionDateSchema, sessionModalitySchema, sessionStartTimeSchema } from './sessions.js';
import { stakeholderListTypeSchema } from './stakeholder-lists.js';

export const EXECUTION_BOARD_PENDING_TARGETS = [
  'SCHEDULE',
  'SESSIONS',
  'SURVEYS',
  'MINUTES',
  'MEASUREMENTS',
  'RESULTS',
  'IMPROVEMENT_PLAN',
] as const;

export type ExecutionBoardPendingTargetValue = (typeof EXECUTION_BOARD_PENDING_TARGETS)[number];

export const EXECUTION_BOARD_PENDING_STATES = ['UNMET', 'NOT_VERIFIABLE'] as const;

export type ExecutionBoardPendingStateValue = (typeof EXECUTION_BOARD_PENDING_STATES)[number];

export const EXECUTION_BOARD_SESSIONS_LIMIT = 5;

export const executionBoardPendingTargetSchema = z.enum(EXECUTION_BOARD_PENDING_TARGETS, {
  message: 'Destino de pendiente no válido',
});

export const executionBoardPendingStateSchema = z.enum(EXECUTION_BOARD_PENDING_STATES, {
  message: 'El estado del pendiente debe ser UNMET o NOT_VERIFIABLE',
});

export const executionBoardPendingItemSchema = z
  .object({
    code: executionPreconditionCodeSchema,
    label: z.string().min(1),
    state: executionBoardPendingStateSchema,
    target: executionBoardPendingTargetSchema,
  })
  .strict();

export type ExecutionBoardPendingItem = z.infer<typeof executionBoardPendingItemSchema>;

export const executionBoardScheduleSchema = z
  .object({
    total: z.number().int().min(0),
    completed: z.number().int().min(0),
    inProgress: z.number().int().min(0),
    pending: z.number().int().min(0),
    overdue: z.number().int().min(0),
    progressPercent: z.number().int().min(0).max(100),
  })
  .strict();

export type ExecutionBoardSchedule = z.infer<typeof executionBoardScheduleSchema>;

export const executionBoardSessionItemSchema = z
  .object({
    id: z.string().min(1),
    stakeholderType: stakeholderListTypeSchema,
    sessionDate: sessionDateSchema,
    startTime: sessionStartTimeSchema,
    modality: sessionModalitySchema,
  })
  .strict();

export type ExecutionBoardSessionItem = z.infer<typeof executionBoardSessionItemSchema>;

export const executionBoardSessionsSchema = z
  .object({
    total: z.number().int().min(0),
    lastSessionDate: sessionDateSchema.nullable(),
    items: z.array(executionBoardSessionItemSchema).max(EXECUTION_BOARD_SESSIONS_LIMIT),
  })
  .strict();

export type ExecutionBoardSessions = z.infer<typeof executionBoardSessionsSchema>;

export const executionBoardUnavailableSectionSchema = z
  .object({
    available: z.literal(false),
  })
  .strict();

export type ExecutionBoardUnavailableSection = z.infer<
  typeof executionBoardUnavailableSectionSchema
>;

export const executionBoardResponseSchema = z
  .object({
    execution: processExecutionDtoSchema,
    schedule: executionBoardScheduleSchema,
    sessions: executionBoardSessionsSchema,
    surveys: executionBoardUnavailableSectionSchema,
    minutes: executionBoardUnavailableSectionSchema,
    results: executionBoardUnavailableSectionSchema,
    pending: z.array(executionBoardPendingItemSchema),
    nextStatus: processExecutionStatusSchema.nullable(),
    generatedAt: z.string().min(1),
  })
  .strict();

export type ExecutionBoardResponse = z.infer<typeof executionBoardResponseSchema>;

export const executionBoardQuerySchema = z.object({}).strict();

export type ExecutionBoardQuery = z.infer<typeof executionBoardQuerySchema>;
