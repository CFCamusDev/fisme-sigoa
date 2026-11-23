import { z } from 'zod';

export const RESOLUTION_TYPES = [
  'EDUCATIONAL_OBJECTIVE',
  'GRADUATE_ATTRIBUTE',
  'IMPROVEMENT_PLAN',
] as const;
export const RESOLUTION_STATUSES = ['REGISTERED', 'APPROVED'] as const;

/** Límites del número; el dominio los repite y una prueba compara ambos lados. */
export const RESOLUTION_NUMBER_MAX_LENGTH = 40;
export const RESOLUTION_NUMBER_PATTERN = /^[A-Za-z0-9\-/. ]+$/;
export const RESOLUTION_ID_MAX_LENGTH = 64;
/** Límite técnico del PDF firmado (10 MiB) y su tipo; cliente y servidor usan el mismo valor. */
export const RESOLUTION_PDF_MAX_BYTES = 10 * 1024 * 1024;
export const RESOLUTION_PDF_MIME_TYPE = 'application/pdf';
export const RESOLUTIONS_PAGE_MAX = 10_000;
export const RESOLUTIONS_PAGE_SIZE_MAX = 100;
export const RESOLUTIONS_PAGE_SIZE_DEFAULT = 20;

const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Fecha de calendario real `YYYY-MM-DD` (rechaza 2026-02-30). */
function isCalendarDate(value: string): boolean {
  if (!CALENDAR_DATE_PATTERN.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export const resolutionTypeSchema = z.enum(RESOLUTION_TYPES, {
  message: 'El tipo debe ser EDUCATIONAL_OBJECTIVE, GRADUATE_ATTRIBUTE o IMPROVEMENT_PLAN',
});
export type ResolutionTypeValue = z.infer<typeof resolutionTypeSchema>;

export const resolutionStatusSchema = z.enum(RESOLUTION_STATUSES, {
  message: 'El estado debe ser REGISTERED o APPROVED',
});
export type ResolutionStatusValue = z.infer<typeof resolutionStatusSchema>;

function calendarDateSchema(label: string) {
  return z
    .string({ message: `Indica la ${label}` })
    .trim()
    .min(1, `Indica la ${label}`)
    .refine(
      (value) => CALENDAR_DATE_PATTERN.test(value),
      `La ${label} no es válida. Elígela en el calendario`,
    )
    .refine(isCalendarDate, `La ${label} no corresponde a un día válido en el calendario`);
}

const resolutionIdSchema = z
  .string()
  .trim()
  .min(1, 'El identificador es obligatorio')
  .max(
    RESOLUTION_ID_MAX_LENGTH,
    `El identificador no puede exceder ${RESOLUTION_ID_MAX_LENGTH} caracteres`,
  );

/** Registrar una resolución (HU-048, RF-048): tipo, número, fecha y versión del catálogo. */
export const registerResolutionRequestSchema = z
  .object({
    type: resolutionTypeSchema,
    number: z
      .string()
      .trim()
      .min(1, 'El número de resolución es obligatorio')
      .max(
        RESOLUTION_NUMBER_MAX_LENGTH,
        `El número de resolución no puede exceder ${RESOLUTION_NUMBER_MAX_LENGTH} caracteres`,
      )
      .regex(
        RESOLUTION_NUMBER_PATTERN,
        'El número solo admite letras, dígitos, guion, barra, punto y espacio',
      ),
    issuedOn: calendarDateSchema('fecha de la resolución'),
    catalogVersionId: resolutionIdSchema,
  })
  .strict();
export type RegisterResolutionRequest = z.infer<typeof registerResolutionRequestSchema>;

/** La aprobación recibe el PDF como cuerpo binario (D2); solo la ruta lleva el identificador. */
export const resolutionIdParamsSchema = z.object({ id: resolutionIdSchema }).strict();
export type ResolutionIdParams = z.infer<typeof resolutionIdParamsSchema>;

export const listResolutionsQuerySchema = z
  .object({
    type: resolutionTypeSchema.optional(),
    status: resolutionStatusSchema.optional(),
    catalogVersionId: resolutionIdSchema.optional(),
    page: z.coerce
      .number()
      .int()
      .min(1, 'La página debe ser mayor o igual a 1')
      .max(RESOLUTIONS_PAGE_MAX, `La página no puede exceder ${RESOLUTIONS_PAGE_MAX}`)
      .default(1),
    pageSize: z.coerce
      .number()
      .int()
      .min(1, 'El tamaño de página debe ser al menos 1')
      .max(
        RESOLUTIONS_PAGE_SIZE_MAX,
        `El tamaño de página no puede exceder ${RESOLUTIONS_PAGE_SIZE_MAX}`,
      )
      .default(RESOLUTIONS_PAGE_SIZE_DEFAULT),
  })
  .strict();
export type ListResolutionsQuery = z.infer<typeof listResolutionsQuerySchema>;

/** `catalogVersionId`, `pdfFileId`, `approvedAt` y `approvedBy` son nulables como en la base. */
export const resolutionDtoSchema = z
  .object({
    id: z.string().min(1),
    type: resolutionTypeSchema,
    number: z.string().min(1),
    issuedOn: calendarDateSchema('fecha de la resolución'),
    status: resolutionStatusSchema,
    catalogVersionId: z.string().min(1).nullable(),
    pdfFileId: z.string().min(1).nullable(),
    approvedAt: z.string().datetime().nullable(),
    approvedBy: z.string().min(1).nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type ResolutionDto = z.infer<typeof resolutionDtoSchema>;

export const listResolutionsResponseSchema = z
  .object({
    items: z.array(resolutionDtoSchema),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(0),
  })
  .strict();
export type ListResolutionsResponse = z.infer<typeof listResolutionsResponseSchema>;
