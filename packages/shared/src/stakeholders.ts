import { z } from 'zod';

export const STAKEHOLDER_KINDS = ['PERSON', 'INSTITUTION'] as const;
export const STAKEHOLDER_STATUSES = ['ACTIVE', 'VOIDED'] as const;

export const STAKEHOLDER_ID_MAX_LENGTH = 64;
export const STAKEHOLDER_FULL_NAME_MAX_LENGTH = 200;
export const STAKEHOLDER_DNI_PATTERN = /^\d{8}$/;
export const STAKEHOLDER_RUC_PATTERN = /^\d{11}$/;
export const STAKEHOLDER_DOCUMENT_PATTERN = /^(\d{8}|\d{11})$/;
export const STAKEHOLDER_MOBILE_PATTERN = /^9\d{8}$/;
export const STAKEHOLDER_EMAIL_MAX_LENGTH = 254;
export const STAKEHOLDER_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const STAKEHOLDER_POSITION_MAX_LENGTH = 150;
export const STAKEHOLDER_INSTITUTION_MAX_LENGTH = 200;
export const STAKEHOLDER_SECTOR_MAX_LENGTH = 150;
export const STAKEHOLDER_CYCLE_MAX_LENGTH = 50;
export const STAKEHOLDER_GRADUATION_YEAR_MIN = 1950;
export const STAKEHOLDER_GRADUATION_YEAR_MAX = 2100;
export const STAKEHOLDER_VOID_REASON_MIN_LENGTH = 10;
export const STAKEHOLDER_VOID_REASON_MAX_LENGTH = 500;
export const STAKEHOLDERS_SEARCH_MAX_LENGTH = 100;
export const STAKEHOLDERS_PAGE_MAX = 10_000;
export const STAKEHOLDERS_PAGE_SIZE_MAX = 100;
export const STAKEHOLDERS_PAGE_SIZE_DEFAULT = 20;

export const stakeholderKindSchema = z.enum(STAKEHOLDER_KINDS, {
  message: 'El tipo de constituyente debe ser PERSON o INSTITUTION',
});
export type StakeholderKindValue = z.infer<typeof stakeholderKindSchema>;

export const stakeholderStatusSchema = z.enum(STAKEHOLDER_STATUSES, {
  message: 'El estado debe ser ACTIVE o VOIDED',
});
export type StakeholderStatusValue = z.infer<typeof stakeholderStatusSchema>;

const stakeholderIdSchema = z
  .string()
  .trim()
  .min(1, 'El identificador es obligatorio')
  .max(
    STAKEHOLDER_ID_MAX_LENGTH,
    `El identificador no puede exceder ${STAKEHOLDER_ID_MAX_LENGTH} caracteres`,
  );

const fullNameSchema = z
  .string()
  .trim()
  .min(1, 'El nombre completo o razón social es obligatorio')
  .max(
    STAKEHOLDER_FULL_NAME_MAX_LENGTH,
    `El nombre no puede exceder ${STAKEHOLDER_FULL_NAME_MAX_LENGTH} caracteres`,
  );

const dniSchema = z
  .string()
  .trim()
  .regex(STAKEHOLDER_DNI_PATTERN, 'El DNI debe tener exactamente 8 dígitos');

const rucSchema = z
  .string()
  .trim()
  .regex(STAKEHOLDER_RUC_PATTERN, 'El RUC debe tener exactamente 11 dígitos');

const optionalEmailSchema = z
  .string()
  .trim()
  .max(
    STAKEHOLDER_EMAIL_MAX_LENGTH,
    `El correo no puede exceder ${STAKEHOLDER_EMAIL_MAX_LENGTH} caracteres`,
  )
  .regex(STAKEHOLDER_EMAIL_PATTERN, 'El correo electrónico no tiene un formato válido')
  .nullable()
  .optional();

const optionalMobileSchema = z
  .string()
  .trim()
  .regex(STAKEHOLDER_MOBILE_PATTERN, 'El celular debe tener 9 dígitos e iniciar con 9')
  .nullable()
  .optional();

const optionalBoundedText = (maxLength: number, label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} no puede estar vacío`)
    .max(maxLength, `${label} no puede exceder ${maxLength} caracteres`)
    .nullable()
    .optional();

const optionalGraduationYearSchema = z
  .number()
  .int('El año de egreso debe ser un número entero')
  .min(
    STAKEHOLDER_GRADUATION_YEAR_MIN,
    `El año de egreso debe ser mayor o igual a ${STAKEHOLDER_GRADUATION_YEAR_MIN}`,
  )
  .max(
    STAKEHOLDER_GRADUATION_YEAR_MAX,
    `El año de egreso no puede exceder ${STAKEHOLDER_GRADUATION_YEAR_MAX}`,
  )
  .nullable()
  .optional();

const registerPersonRequestSchema = z
  .object({
    kind: z.literal('PERSON'),
    fullName: fullNameSchema,
    dni: dniSchema,
    email: optionalEmailSchema,
    mobile: optionalMobileSchema,
    position: optionalBoundedText(STAKEHOLDER_POSITION_MAX_LENGTH, 'El cargo'),
    institution: optionalBoundedText(STAKEHOLDER_INSTITUTION_MAX_LENGTH, 'La institución'),
    sector: optionalBoundedText(STAKEHOLDER_SECTOR_MAX_LENGTH, 'El sector'),
    graduationYear: optionalGraduationYearSchema,
    cycle: optionalBoundedText(STAKEHOLDER_CYCLE_MAX_LENGTH, 'El ciclo'),
  })
  .strict();

const registerInstitutionRequestSchema = z
  .object({
    kind: z.literal('INSTITUTION'),
    fullName: fullNameSchema,
    ruc: rucSchema,
    email: optionalEmailSchema,
    mobile: optionalMobileSchema,
    position: optionalBoundedText(STAKEHOLDER_POSITION_MAX_LENGTH, 'El cargo'),
    sector: optionalBoundedText(STAKEHOLDER_SECTOR_MAX_LENGTH, 'El sector'),
  })
  .strict();

export const registerStakeholderRequestSchema = z.discriminatedUnion('kind', [
  registerPersonRequestSchema,
  registerInstitutionRequestSchema,
]);
export type RegisterStakeholderRequest = z.infer<typeof registerStakeholderRequestSchema>;

export const editStakeholderRequestSchema = z
  .object({
    fullName: fullNameSchema.optional(),
    dni: dniSchema.nullable().optional(),
    ruc: rucSchema.nullable().optional(),
    email: optionalEmailSchema,
    mobile: optionalMobileSchema,
    position: optionalBoundedText(STAKEHOLDER_POSITION_MAX_LENGTH, 'El cargo'),
    institution: optionalBoundedText(STAKEHOLDER_INSTITUTION_MAX_LENGTH, 'La institución'),
    sector: optionalBoundedText(STAKEHOLDER_SECTOR_MAX_LENGTH, 'El sector'),
    graduationYear: optionalGraduationYearSchema,
    cycle: optionalBoundedText(STAKEHOLDER_CYCLE_MAX_LENGTH, 'El ciclo'),
  })
  .strict()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Debe enviar al menos un campo para actualizar.',
  });
export type EditStakeholderRequest = z.infer<typeof editStakeholderRequestSchema>;

export const voidStakeholderRequestSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(
        STAKEHOLDER_VOID_REASON_MIN_LENGTH,
        `El motivo de anulación debe tener al menos ${STAKEHOLDER_VOID_REASON_MIN_LENGTH} caracteres`,
      )
      .max(
        STAKEHOLDER_VOID_REASON_MAX_LENGTH,
        `El motivo de anulación no puede exceder ${STAKEHOLDER_VOID_REASON_MAX_LENGTH} caracteres`,
      ),
  })
  .strict();
export type VoidStakeholderRequest = z.infer<typeof voidStakeholderRequestSchema>;

export const stakeholderIdParamsSchema = z.object({ id: stakeholderIdSchema }).strict();
export type StakeholderIdParams = z.infer<typeof stakeholderIdParamsSchema>;

export const listStakeholdersQuerySchema = z
  .object({
    search: z
      .string()
      .trim()
      .max(
        STAKEHOLDERS_SEARCH_MAX_LENGTH,
        `La búsqueda no puede exceder ${STAKEHOLDERS_SEARCH_MAX_LENGTH} caracteres`,
      )
      .optional(),
    kind: stakeholderKindSchema.optional(),
    status: stakeholderStatusSchema.optional(),
    document: z
      .string()
      .trim()
      .regex(
        STAKEHOLDER_DOCUMENT_PATTERN,
        'El documento debe ser un DNI de 8 dígitos o un RUC de 11 dígitos',
      )
      .optional(),
    page: z.coerce
      .number()
      .int()
      .min(1, 'La página debe ser mayor o igual a 1')
      .max(STAKEHOLDERS_PAGE_MAX, `La página no puede exceder ${STAKEHOLDERS_PAGE_MAX}`)
      .default(1),
    pageSize: z.coerce
      .number()
      .int()
      .min(1, 'El tamaño de página debe ser al menos 1')
      .max(
        STAKEHOLDERS_PAGE_SIZE_MAX,
        `El tamaño de página no puede exceder ${STAKEHOLDERS_PAGE_SIZE_MAX}`,
      )
      .default(STAKEHOLDERS_PAGE_SIZE_DEFAULT),
  })
  .strict();
export type ListStakeholdersQuery = z.infer<typeof listStakeholdersQuerySchema>;

export const stakeholderDtoSchema = z
  .object({
    id: z.string().min(1),
    kind: stakeholderKindSchema,
    fullName: z.string().min(1),
    dni: z.string().min(1).nullable(),
    ruc: z.string().min(1).nullable(),
    email: z.string().min(1).nullable(),
    mobile: z.string().min(1).nullable(),
    position: z.string().min(1).nullable(),
    institution: z.string().min(1).nullable(),
    sector: z.string().min(1).nullable(),
    graduationYear: z.number().int().nullable(),
    cycle: z.string().min(1).nullable(),
    status: stakeholderStatusSchema,
    voidReason: z.string().min(1).nullable(),
    voidedAt: z.string().datetime().nullable(),
    voidedBy: z.string().min(1).nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type StakeholderDto = z.infer<typeof stakeholderDtoSchema>;

export const listStakeholdersResponseSchema = z
  .object({
    items: z.array(stakeholderDtoSchema),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(0),
  })
  .strict();
export type ListStakeholdersResponse = z.infer<typeof listStakeholdersResponseSchema>;
