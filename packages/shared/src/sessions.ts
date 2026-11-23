import { z } from 'zod';
import { stakeholderListTypeSchema } from './stakeholder-lists.js';

export const SESSION_MODALITIES = ['VIRTUAL', 'IN_PERSON', 'HYBRID'] as const;
export type SessionModalityValue = (typeof SESSION_MODALITIES)[number];

export const SESSION_ID_MAX_LENGTH = 64;
export const SESSION_URL_MAX_LENGTH = 500;
export const SESSION_DATE_YEAR_MIN = 2000;
export const SESSION_DATE_YEAR_MAX = 2100;
export const SESSION_MAX_EXECUTIONS = 20;
export const SESSIONS_PAGE_MAX = 10_000;
export const SESSIONS_PAGE_SIZE_MAX = 100;
export const SESSIONS_PAGE_SIZE_DEFAULT = 20;

export const sessionModalitySchema = z.enum(SESSION_MODALITIES, {
  message: 'La modalidad debe ser VIRTUAL, IN_PERSON o HYBRID',
});

const identifierSchema = z
  .string()
  .trim()
  .min(1, 'El identificador es obligatorio')
  .max(
    SESSION_ID_MAX_LENGTH,
    `El identificador no puede exceder ${SESSION_ID_MAX_LENGTH} caracteres`,
  );

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

export const sessionDateSchema = z
  .string()
  .trim()
  .refine((value) => {
    const match = DATE_PATTERN.exec(value);
    if (!match?.[1] || !match[2] || !match[3]) {
      return false;
    }
    const year = Number.parseInt(match[1], 10);
    const month = Number.parseInt(match[2], 10);
    const day = Number.parseInt(match[3], 10);
    if (year < SESSION_DATE_YEAR_MIN || year > SESSION_DATE_YEAR_MAX) {
      return false;
    }
    const utc = new Date(Date.UTC(year, month - 1, day));
    return (
      utc.getUTCFullYear() === year && utc.getUTCMonth() + 1 === month && utc.getUTCDate() === day
    );
  }, `La fecha debe tener formato AAAA-MM-DD válido entre ${SESSION_DATE_YEAR_MIN} y ${SESSION_DATE_YEAR_MAX}`);

export const sessionStartTimeSchema = z
  .string()
  .trim()
  .regex(TIME_PATTERN, 'La hora de inicio debe tener formato HH:mm (00:00 a 23:59)');

const rawSessionUrlSchema = z
  .string()
  .trim()
  .max(SESSION_URL_MAX_LENGTH, `El enlace no puede superar ${SESSION_URL_MAX_LENGTH} caracteres`)
  .refine((value) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'El enlace debe ser una URL válida con protocolo http:// o https://');

const optionalNullableUrlSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  rawSessionUrlSchema.nullable().optional(),
);

const sessionExecutionIdsSchema = z
  .array(identifierSchema)
  .min(1, 'La sesión debe vincularse a al menos una ejecución de proceso')
  .max(
    SESSION_MAX_EXECUTIONS,
    `La sesión no puede vincularse a más de ${SESSION_MAX_EXECUTIONS} ejecuciones`,
  )
  .refine((ids) => new Set(ids).size === ids.length, 'No se pueden vincular ejecuciones repetidas');

export const createSessionRequestSchema = z
  .object({
    stakeholderType: stakeholderListTypeSchema,
    stakeholderListId: identifierSchema.nullable().optional(),
    sessionDate: sessionDateSchema,
    startTime: sessionStartTimeSchema,
    modality: sessionModalitySchema,
    meetingUrl: optionalNullableUrlSchema,
    recordingUrl: optionalNullableUrlSchema,
    executionIds: sessionExecutionIdsSchema,
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.modality === 'VIRTUAL') {
      if (!data.meetingUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['meetingUrl'],
          message: 'El enlace de la reunión es obligatorio para sesiones virtuales',
        });
      }
      if (!data.recordingUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['recordingUrl'],
          message: 'El enlace de la grabación es obligatorio para sesiones virtuales',
        });
      }
    } else if (data.modality === 'HYBRID') {
      if (!data.meetingUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['meetingUrl'],
          message: 'El enlace de la reunión es obligatorio para sesiones híbridas',
        });
      }
    } else if (data.modality === 'IN_PERSON') {
      if (data.meetingUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['meetingUrl'],
          message: 'Una sesión presencial no lleva enlace de reunión',
        });
      }
      if (data.recordingUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['recordingUrl'],
          message: 'Una sesión presencial no lleva enlace de grabación',
        });
      }
    }
  });

export type CreateSessionRequest = z.infer<typeof createSessionRequestSchema>;

export const updateSessionRequestSchema = z
  .object({
    stakeholderType: stakeholderListTypeSchema.optional(),
    stakeholderListId: identifierSchema.nullable().optional(),
    sessionDate: sessionDateSchema.optional(),
    startTime: sessionStartTimeSchema.optional(),
    modality: sessionModalitySchema.optional(),
    meetingUrl: optionalNullableUrlSchema,
    recordingUrl: optionalNullableUrlSchema,
    executionIds: sessionExecutionIdsSchema.optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const hasAnyField = Object.values(data).some((value) => value !== undefined);
    if (!hasAnyField) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Debes indicar al menos un campo para actualizar la sesión',
      });
    }

    if (data.modality === 'VIRTUAL') {
      if (data.meetingUrl === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['meetingUrl'],
          message: 'El enlace de la reunión es obligatorio para sesiones virtuales',
        });
      }
      if (data.recordingUrl === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['recordingUrl'],
          message: 'El enlace de la grabación es obligatorio para sesiones virtuales',
        });
      }
    } else if (data.modality === 'HYBRID') {
      if (data.meetingUrl === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['meetingUrl'],
          message: 'El enlace de la reunión es obligatorio para sesiones híbridas',
        });
      }
    } else if (data.modality === 'IN_PERSON') {
      if (data.meetingUrl !== undefined && data.meetingUrl !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['meetingUrl'],
          message: 'Una sesión presencial no lleva enlace de reunión',
        });
      }
      if (data.recordingUrl !== undefined && data.recordingUrl !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['recordingUrl'],
          message: 'Una sesión presencial no lleva enlace de grabación',
        });
      }
    }
  });

export type UpdateSessionRequest = z.infer<typeof updateSessionRequestSchema>;

export const listSessionsByExecutionQuerySchema = z
  .object({
    page: z.coerce
      .number()
      .int('La página debe ser un número entero')
      .min(1, 'La página debe ser mayor o igual a 1')
      .max(SESSIONS_PAGE_MAX, `La página no puede exceder ${SESSIONS_PAGE_MAX}`)
      .default(1),
    pageSize: z.coerce
      .number()
      .int('El tamaño de página debe ser un número entero')
      .min(1, 'El tamaño de página debe ser mayor o igual a 1')
      .max(SESSIONS_PAGE_SIZE_MAX, `El tamaño de página no puede exceder ${SESSIONS_PAGE_SIZE_MAX}`)
      .default(SESSIONS_PAGE_SIZE_DEFAULT),
  })
  .strict();

export type ListSessionsByExecutionQuery = z.infer<typeof listSessionsByExecutionQuerySchema>;

export const sessionDtoSchema = z
  .object({
    id: z.string(),
    stakeholderType: stakeholderListTypeSchema,
    stakeholderListId: z.string().nullable(),
    sessionDate: sessionDateSchema,
    startTime: sessionStartTimeSchema,
    modality: sessionModalitySchema,
    meetingUrl: rawSessionUrlSchema.nullable(),
    recordingUrl: rawSessionUrlSchema.nullable(),
    executionIds: z.array(z.string()),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export type SessionDto = z.infer<typeof sessionDtoSchema>;

export const sessionListItemSchema = sessionDtoSchema
  .extend({
    attendeeCount: z.number().int().nonnegative(),
  })
  .strict();

export type SessionListItemDto = z.infer<typeof sessionListItemSchema>;

export const listSessionsResponseSchema = z
  .object({
    items: z.array(sessionListItemSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
  })
  .strict();

export type ListSessionsResponse = z.infer<typeof listSessionsResponseSchema>;

export const sessionIdParamSchema = z
  .object({
    id: identifierSchema,
  })
  .strict();

export type SessionIdParam = z.infer<typeof sessionIdParamSchema>;

export const processExecutionIdParamSchema = z
  .object({
    id: identifierSchema,
  })
  .strict();

export type ProcessExecutionIdParam = z.infer<typeof processExecutionIdParamSchema>;
