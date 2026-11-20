import { z } from 'zod';

export const STAKEHOLDER_LIST_TYPES = [
  'ADVISORY_BOARD',
  'EMPLOYER',
  'GRADUATE',
  'STUDENT',
  'TEACHER',
] as const;

export const STAKEHOLDER_LIST_ID_MAX_LENGTH = 64;
export const STAKEHOLDER_LIST_YEAR_MIN = 2000;
export const STAKEHOLDER_LIST_YEAR_MAX = 2100;
export const STAKEHOLDER_LIST_STUDY_PLAN_NUMBER_MAX_LENGTH = 20;
export const STAKEHOLDER_LIST_VERSION_MAX_LENGTH = 20;
export const STAKEHOLDER_LIST_MEMBER_ACTIVITY_MAX_LENGTH = 120;
export const STAKEHOLDER_LIST_MEMBER_REPRESENTATIVE_MAX_LENGTH = 150;
export const STAKEHOLDER_LISTS_PAGE_MAX = 10_000;
export const STAKEHOLDER_LISTS_PAGE_SIZE_MAX = 100;
export const STAKEHOLDER_LISTS_PAGE_SIZE_DEFAULT = 20;
export const STAKEHOLDER_LIST_PDF_ANNEX_CODE = 'FO-03' as const;

export const stakeholderListTypeSchema = z.enum(STAKEHOLDER_LIST_TYPES, {
  message: 'El tipo de lista debe ser ADVISORY_BOARD, EMPLOYER, GRADUATE, STUDENT o TEACHER',
});
export type StakeholderListTypeValue = z.infer<typeof stakeholderListTypeSchema>;

const stakeholderListIdSchema = z
  .string()
  .trim()
  .min(1, 'El identificador es obligatorio')
  .max(
    STAKEHOLDER_LIST_ID_MAX_LENGTH,
    `El identificador no puede exceder ${STAKEHOLDER_LIST_ID_MAX_LENGTH} caracteres`,
  );

const listYearSchema = z
  .number()
  .int('El año de la lista debe ser un número entero')
  .min(
    STAKEHOLDER_LIST_YEAR_MIN,
    `El año de la lista debe ser mayor o igual a ${STAKEHOLDER_LIST_YEAR_MIN}`,
  )
  .max(
    STAKEHOLDER_LIST_YEAR_MAX,
    `El año de la lista debe ser menor o igual a ${STAKEHOLDER_LIST_YEAR_MAX}`,
  );

const optionalHeaderText = (maxLength: number, label: string) =>
  z
    .string()
    .trim()
    .max(maxLength, `${label} no puede exceder ${maxLength} caracteres`)
    .nullable()
    .optional();

export const createStakeholderListRequestSchema = z
  .object({
    type: stakeholderListTypeSchema,
    year: listYearSchema,
    studyPlanNumber: optionalHeaderText(
      STAKEHOLDER_LIST_STUDY_PLAN_NUMBER_MAX_LENGTH,
      'El número de plan de estudios',
    ),
    version: optionalHeaderText(STAKEHOLDER_LIST_VERSION_MAX_LENGTH, 'La versión de la lista'),
  })
  .strict();
export type CreateStakeholderListRequest = z.infer<typeof createStakeholderListRequestSchema>;

export const addStakeholderListMemberRequestSchema = z
  .object({
    stakeholderId: stakeholderListIdSchema,
    activity: optionalHeaderText(STAKEHOLDER_LIST_MEMBER_ACTIVITY_MAX_LENGTH, 'La actividad'),
    representative: optionalHeaderText(
      STAKEHOLDER_LIST_MEMBER_REPRESENTATIVE_MAX_LENGTH,
      'El representante',
    ),
  })
  .strict();
export type AddStakeholderListMemberRequest = z.infer<typeof addStakeholderListMemberRequestSchema>;

export const copyStakeholderListRequestSchema = z
  .object({
    year: listYearSchema,
  })
  .strict();
export type CopyStakeholderListRequest = z.infer<typeof copyStakeholderListRequestSchema>;

export const stakeholderListIdParamsSchema = z
  .object({
    id: stakeholderListIdSchema,
  })
  .strict();
export type StakeholderListIdParams = z.infer<typeof stakeholderListIdParamsSchema>;

export const exportStakeholderListPdfParamsSchema = stakeholderListIdParamsSchema;
export type ExportStakeholderListPdfParams = z.infer<typeof exportStakeholderListPdfParamsSchema>;

export const exportStakeholderListPdfQuerySchema = z.object({}).strict();
export type ExportStakeholderListPdfQuery = z.infer<typeof exportStakeholderListPdfQuerySchema>;

export const listStakeholderListsQuerySchema = z
  .object({
    type: stakeholderListTypeSchema.optional(),
    year: z.coerce
      .number()
      .int('El año debe ser un número entero')
      .min(
        STAKEHOLDER_LIST_YEAR_MIN,
        `El año debe ser mayor o igual a ${STAKEHOLDER_LIST_YEAR_MIN}`,
      )
      .max(
        STAKEHOLDER_LIST_YEAR_MAX,
        `El año debe ser menor o igual a ${STAKEHOLDER_LIST_YEAR_MAX}`,
      )
      .optional(),
    includeMembers: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    page: z.coerce
      .number()
      .int()
      .min(1, 'La página debe ser mayor o igual a 1')
      .max(STAKEHOLDER_LISTS_PAGE_MAX, `La página no puede exceder ${STAKEHOLDER_LISTS_PAGE_MAX}`)
      .default(1),
    pageSize: z.coerce
      .number()
      .int()
      .min(1, 'El tamaño de página debe ser al menos 1')
      .max(
        STAKEHOLDER_LISTS_PAGE_SIZE_MAX,
        `El tamaño de página no puede exceder ${STAKEHOLDER_LISTS_PAGE_SIZE_MAX}`,
      )
      .default(STAKEHOLDER_LISTS_PAGE_SIZE_DEFAULT),
  })
  .strict()
  .refine((data) => !data.includeMembers || (data.type !== undefined && data.year !== undefined), {
    message: 'Para incluir miembros debe especificar tipo y año de la lista',
    path: ['includeMembers'],
  });
export type ListStakeholderListsQuery = z.infer<typeof listStakeholderListsQuerySchema>;

export const stakeholderListMemberDtoSchema = z
  .object({
    id: z.string().min(1),
    listId: z.string().min(1),
    stakeholderId: z.string().min(1),
    fullName: z.string().min(1),
    institution: z.string().min(1).nullable(),
    ruc: z.string().min(1).nullable(),
    sector: z.string().min(1).nullable(),
    representative: z.string().min(1).nullable(),
    activity: z.string().min(1).nullable(),
    email: z.string().min(1).nullable(),
    mobile: z.string().min(1).nullable(),
    position: z.string().min(1).nullable(),
    graduationYear: z.number().int().nullable(),
    cycle: z.string().min(1).nullable(),
    createdAt: z.string().datetime(),
  })
  .strict();
export type StakeholderListMemberDto = z.infer<typeof stakeholderListMemberDtoSchema>;

export const stakeholderListDtoSchema = z
  .object({
    id: z.string().min(1),
    programId: z.string().min(1),
    type: stakeholderListTypeSchema,
    year: z.number().int(),
    studyPlanNumber: z.string().min(1).nullable(),
    version: z.string().min(1).nullable(),
    memberCount: z.number().int().min(0),
    members: z.array(stakeholderListMemberDtoSchema).nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type StakeholderListDto = z.infer<typeof stakeholderListDtoSchema>;

export const listStakeholderListsResponseSchema = z
  .object({
    items: z.array(stakeholderListDtoSchema),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(0),
  })
  .strict();
export type ListStakeholderListsResponse = z.infer<typeof listStakeholderListsResponseSchema>;

export const copyStakeholderListSkippedReasonSchema = z.enum(['VOIDED', 'INCOMPLETE']);
export type CopyStakeholderListSkippedReason = z.infer<
  typeof copyStakeholderListSkippedReasonSchema
>;

export const copyStakeholderListSkippedItemSchema = z
  .object({
    stakeholderId: z.string().min(1),
    fullName: z.string().min(1),
    reason: copyStakeholderListSkippedReasonSchema,
  })
  .strict();
export type CopyStakeholderListSkippedItem = z.infer<typeof copyStakeholderListSkippedItemSchema>;

export const copyStakeholderListResponseSchema = z
  .object({
    list: stakeholderListDtoSchema,
    skipped: z.array(copyStakeholderListSkippedItemSchema),
  })
  .strict();
export type CopyStakeholderListResponse = z.infer<typeof copyStakeholderListResponseSchema>;
