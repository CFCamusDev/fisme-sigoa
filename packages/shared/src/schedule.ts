import { z } from 'zod';

export const SCHEDULE_ACTIVITY_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED'] as const;
export type ScheduleActivityStatusValue = (typeof SCHEDULE_ACTIVITY_STATUSES)[number];

export const SCHEDULE_CHANGEABLE_STATUSES = ['IN_PROGRESS', 'COMPLETED'] as const;
export type ScheduleChangeableStatusValue = (typeof SCHEDULE_CHANGEABLE_STATUSES)[number];

export const SCHEDULE_ID_MAX_LENGTH = 64;
export const SCHEDULE_ACTIVITY_MAX_LENGTH = 300;
export const SCHEDULE_RESPONSIBLE_MAX_LENGTH = 150;
export const SCHEDULE_GOAL_MAX_LENGTH = 300;
export const SCHEDULE_INDICATOR_MAX_LENGTH = 300;
export const SCHEDULE_DATE_YEAR_MIN = 2000;
export const SCHEDULE_DATE_YEAR_MAX = 2100;
export const SCHEDULE_MAX_ITEMS = 50;

export const scheduleActivityStatusSchema = z.enum(SCHEDULE_ACTIVITY_STATUSES, {
  message: 'El estado de la actividad debe ser PENDING, IN_PROGRESS o COMPLETED',
});

const identifierSchema = z
  .string()
  .trim()
  .min(1, 'El identificador es obligatorio')
  .max(
    SCHEDULE_ID_MAX_LENGTH,
    `El identificador no puede exceder ${SCHEDULE_ID_MAX_LENGTH} caracteres`,
  );

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const scheduleDateSchema = z
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
    if (year < SCHEDULE_DATE_YEAR_MIN || year > SCHEDULE_DATE_YEAR_MAX) {
      return false;
    }
    const utc = new Date(Date.UTC(year, month - 1, day));
    return (
      utc.getUTCFullYear() === year && utc.getUTCMonth() + 1 === month && utc.getUTCDate() === day
    );
  }, `La fecha debe tener formato AAAA-MM-DD válido entre ${SCHEDULE_DATE_YEAR_MIN} y ${SCHEDULE_DATE_YEAR_MAX}`);

export const scheduleActivityInputSchema = z
  .object({
    id: identifierSchema.optional(),
    activity: z
      .string()
      .trim()
      .min(1, 'La actividad es obligatoria')
      .max(
        SCHEDULE_ACTIVITY_MAX_LENGTH,
        `La actividad no puede exceder ${SCHEDULE_ACTIVITY_MAX_LENGTH} caracteres`,
      ),
    responsible: z
      .string()
      .trim()
      .min(1, 'El responsable es obligatorio')
      .max(
        SCHEDULE_RESPONSIBLE_MAX_LENGTH,
        `El responsable no puede exceder ${SCHEDULE_RESPONSIBLE_MAX_LENGTH} caracteres`,
      ),
    goal: z
      .string()
      .trim()
      .max(
        SCHEDULE_GOAL_MAX_LENGTH,
        `La meta no puede exceder ${SCHEDULE_GOAL_MAX_LENGTH} caracteres`,
      )
      .nullable()
      .optional(),
    indicator: z
      .string()
      .trim()
      .max(
        SCHEDULE_INDICATOR_MAX_LENGTH,
        `El indicador no puede exceder ${SCHEDULE_INDICATOR_MAX_LENGTH} caracteres`,
      )
      .nullable()
      .optional(),
    startDate: scheduleDateSchema.nullable().optional(),
    endDate: scheduleDateSchema.nullable().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.startDate && data.endDate && data.endDate < data.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: 'La fecha de fin no puede ser anterior a la fecha de inicio',
      });
    }
  });

export type ScheduleActivityInput = z.infer<typeof scheduleActivityInputSchema>;

export const proposeScheduleRequestSchema = z.object({}).strict();
export type ProposeScheduleRequest = z.infer<typeof proposeScheduleRequestSchema>;

export const saveScheduleRequestSchema = z
  .object({
    activities: z
      .array(scheduleActivityInputSchema)
      .max(
        SCHEDULE_MAX_ITEMS,
        `El cronograma no puede tener más de ${SCHEDULE_MAX_ITEMS} actividades`,
      ),
  })
  .strict();

export type SaveScheduleRequest = z.infer<typeof saveScheduleRequestSchema>;

export const changeScheduleActivityStatusRequestSchema = z
  .object({
    status: z.enum(SCHEDULE_CHANGEABLE_STATUSES, {
      message: 'El estado destino debe ser IN_PROGRESS o COMPLETED',
    }),
    actualEndDate: scheduleDateSchema.optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.status !== 'COMPLETED' && data.actualEndDate !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['actualEndDate'],
        message: 'La fecha real de término solo se admite al completar la actividad',
      });
    }
  });

export type ChangeScheduleActivityStatusRequest = z.infer<
  typeof changeScheduleActivityStatusRequestSchema
>;

export const scheduleActivityIdParamSchema = z
  .object({
    id: identifierSchema,
  })
  .strict();

export type ScheduleActivityIdParam = z.infer<typeof scheduleActivityIdParamSchema>;

export const scheduleActivityDtoSchema = z
  .object({
    id: z.string(),
    processExecutionId: z.string(),
    number: z.number().int().min(1),
    activity: z.string(),
    responsible: z.string(),
    goal: z.string().nullable(),
    indicator: z.string().nullable(),
    startDate: z.string().nullable(),
    endDate: z.string().nullable(),
    status: scheduleActivityStatusSchema,
    actualEndDate: z.string().nullable(),
    isOverdue: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();

export type ScheduleActivityDto = z.infer<typeof scheduleActivityDtoSchema>;

export const scheduleResponseSchema = z
  .object({
    items: z.array(scheduleActivityDtoSchema),
  })
  .strict();

export type ScheduleResponse = z.infer<typeof scheduleResponseSchema>;
