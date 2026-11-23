import { z } from 'zod';

export const PROCESS_TYPES = ['P611', 'P612', 'P613', 'P621', 'P622', 'P623'] as const;
export type ProcessTypeValue = (typeof PROCESS_TYPES)[number];

export const PROCESS_EXECUTION_STATUSES = [
  'PLANNED',
  'IN_PROGRESS',
  'CONSOLIDATING',
  'PENDING_APPROVAL',
  'CLOSED',
  'VOIDED',
] as const;
export type ProcessExecutionStatusValue = (typeof PROCESS_EXECUTION_STATUSES)[number];

export const PROCESS_EXECUTION_ID_MAX_LENGTH = 64;
export const PROCESS_EXECUTION_NAME_MAX_LENGTH = 150;
export const PROCESS_EXECUTION_YEAR_MIN = 2000;
export const PROCESS_EXECUTION_YEAR_MAX = 2100;
export const PROCESS_EXECUTIONS_PAGE_MAX = 10_000;
export const PROCESS_EXECUTIONS_PAGE_SIZE_MAX = 100;
export const PROCESS_EXECUTIONS_PAGE_SIZE_DEFAULT = 20;

export const processTypeSchema = z.enum(PROCESS_TYPES, {
  message: 'El tipo de proceso debe ser P611, P612, P613, P621, P622 o P623',
});

export const processExecutionStatusSchema = z.enum(PROCESS_EXECUTION_STATUSES, {
  message:
    'El estado de la ejecución debe ser PLANNED, IN_PROGRESS, CONSOLIDATING, PENDING_APPROVAL, CLOSED o VOIDED',
});

const identifierSchema = z
  .string()
  .trim()
  .min(1, 'El identificador es obligatorio')
  .max(
    PROCESS_EXECUTION_ID_MAX_LENGTH,
    `El identificador no puede exceder ${PROCESS_EXECUTION_ID_MAX_LENGTH} caracteres`,
  );

const executionYearSchema = z
  .number()
  .int('El año debe ser un número entero')
  .min(PROCESS_EXECUTION_YEAR_MIN, `El año debe ser mayor o igual a ${PROCESS_EXECUTION_YEAR_MIN}`)
  .max(PROCESS_EXECUTION_YEAR_MAX, `El año debe ser menor o igual a ${PROCESS_EXECUTION_YEAR_MAX}`);

export const createProcessExecutionRequestSchema = z
  .object({
    type: processTypeSchema,
    year: executionYearSchema,
    semesterId: identifierSchema.nullable().optional(),
    catalogVersionId: identifierSchema,
    name: z
      .string()
      .trim()
      .max(
        PROCESS_EXECUTION_NAME_MAX_LENGTH,
        `El nombre no puede exceder ${PROCESS_EXECUTION_NAME_MAX_LENGTH} caracteres`,
      )
      .nullable()
      .optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const hasSemester = typeof data.semesterId === 'string' && data.semesterId.length > 0;
    if (data.type === 'P622' && !hasSemester) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['semesterId'],
        message: 'El proceso P622 requiere seleccionar un semestre',
      });
    }
    if (data.type !== 'P622' && hasSemester) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['semesterId'],
        message: `El proceso ${data.type} es anual y no admite semestre`,
      });
    }
  });

export type CreateProcessExecutionRequest = z.infer<typeof createProcessExecutionRequestSchema>;

export const listProcessExecutionsQuerySchema = z
  .object({
    type: processTypeSchema.optional(),
    year: z.coerce
      .number()
      .int('El año debe ser un número entero')
      .min(
        PROCESS_EXECUTION_YEAR_MIN,
        `El año debe ser mayor o igual a ${PROCESS_EXECUTION_YEAR_MIN}`,
      )
      .max(
        PROCESS_EXECUTION_YEAR_MAX,
        `El año debe ser menor o igual a ${PROCESS_EXECUTION_YEAR_MAX}`,
      )
      .optional(),
    status: processExecutionStatusSchema.optional(),
    page: z.coerce
      .number()
      .int()
      .min(1, 'La página debe ser mayor o igual a 1')
      .max(PROCESS_EXECUTIONS_PAGE_MAX, `La página no puede exceder ${PROCESS_EXECUTIONS_PAGE_MAX}`)
      .default(1),
    pageSize: z.coerce
      .number()
      .int()
      .min(1, 'El tamaño de página debe ser mayor o igual a 1')
      .max(
        PROCESS_EXECUTIONS_PAGE_SIZE_MAX,
        `El tamaño de página no puede exceder ${PROCESS_EXECUTIONS_PAGE_SIZE_MAX}`,
      )
      .default(PROCESS_EXECUTIONS_PAGE_SIZE_DEFAULT),
  })
  .strict();

export type ListProcessExecutionsQuery = z.infer<typeof listProcessExecutionsQuerySchema>;

export const processExecutionDtoSchema = z
  .object({
    id: z.string(),
    type: processTypeSchema,
    name: z.string(),
    year: z.number().int(),
    semesterId: z.string().nullable(),
    semesterCode: z.string().nullable(),
    catalogVersionId: z.string(),
    catalogVersionNumber: z.number().int(),
    status: processExecutionStatusSchema,
    voidReason: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();

export type ProcessExecutionDto = z.infer<typeof processExecutionDtoSchema>;

export const listProcessExecutionsResponseSchema = z
  .object({
    items: z.array(processExecutionDtoSchema),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(0),
  })
  .strict();

export type ListProcessExecutionsResponse = z.infer<typeof listProcessExecutionsResponseSchema>;
