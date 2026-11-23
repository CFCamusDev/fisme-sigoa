import { z } from 'zod';

export const COMMITTEE_MEMBERS_MIN = 1;
export const COMMITTEE_MEMBERS_MAX = 30;
export const COMMITTEE_MEMBER_NAME_MAX_LENGTH = 160;
export const COMMITTEE_MEMBER_DEGREE_MAX_LENGTH = 60;
export const COMMITTEE_ID_MAX_LENGTH = 64;
export const COMMITTEE_EMAIL_MAX_LENGTH = 254;
export const COMMITTEE_LIST_PAGE_SIZE_DEFAULT = 10;
export const COMMITTEE_LIST_PAGE_SIZE_MAX = 50;
export const COMMITTEE_PERIOD_YEAR_MIN = 2000;
export const COMMITTEE_PERIOD_YEAR_MAX = 2100;

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function isValidCalendarDate(raw: string): boolean {
  const match = ISO_DATE_PATTERN.exec(raw);
  if (!match?.[1] || !match[2] || !match[3]) {
    return false;
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);

  if (year < COMMITTEE_PERIOD_YEAR_MIN || year > COMMITTEE_PERIOD_YEAR_MAX) {
    return false;
  }

  const utcDate = new Date(Date.UTC(year, month - 1, day));
  return (
    utcDate.getUTCFullYear() === year &&
    utcDate.getUTCMonth() + 1 === month &&
    utcDate.getUTCDate() === day
  );
}

function calendarDateSchema(label: string) {
  return z
    .string({ message: `Indica la ${label}` })
    .trim()
    .min(1, `Indica la ${label}`)
    .refine(
      (value) => ISO_DATE_PATTERN.test(value),
      `La ${label} no es válida. Elígela en el calendario`,
    )
    .refine(
      isValidCalendarDate,
      `La fecha debe corresponder a un día válido entre ${COMMITTEE_PERIOD_YEAR_MIN} y ${COMMITTEE_PERIOD_YEAR_MAX}`,
    );
}

export const committeeMemberPositionSchema = z.enum(['PRESIDENT', 'MEMBER']);

export type CommitteeMemberPositionDto = z.infer<typeof committeeMemberPositionSchema>;

const optionalNullableUserIdSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z
    .string()
    .trim()
    .min(1, 'El identificador del usuario es inválido')
    .max(
      COMMITTEE_ID_MAX_LENGTH,
      `El identificador del usuario no puede superar los ${COMMITTEE_ID_MAX_LENGTH} caracteres`,
    )
    .nullable()
    .optional(),
);

const optionalNullableUserEmailSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z
    .string()
    .trim()
    .max(
      COMMITTEE_EMAIL_MAX_LENGTH,
      `El correo electrónico no puede superar los ${COMMITTEE_EMAIL_MAX_LENGTH} caracteres`,
    )
    .email('El formato del correo electrónico es inválido')
    .transform((value) => value.toLowerCase())
    .nullable()
    .optional(),
);

export const committeeMemberInputSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(1, 'El nombre completo del miembro es obligatorio')
      .max(
        COMMITTEE_MEMBER_NAME_MAX_LENGTH,
        `El nombre completo no puede superar los ${COMMITTEE_MEMBER_NAME_MAX_LENGTH} caracteres`,
      ),
    degree: z
      .string()
      .trim()
      .min(1, 'El grado académico es obligatorio')
      .max(
        COMMITTEE_MEMBER_DEGREE_MAX_LENGTH,
        `El grado académico no puede superar los ${COMMITTEE_MEMBER_DEGREE_MAX_LENGTH} caracteres`,
      ),
    position: committeeMemberPositionSchema,
    userId: optionalNullableUserIdSchema,
    userEmail: optionalNullableUserEmailSchema,
  })
  .strict()
  .refine((member) => !(member.userId && member.userEmail), {
    message: 'Indica solo el identificador o el correo electrónico del usuario, no ambos',
    path: ['userEmail'],
  });

export type CommitteeMemberInput = z.infer<typeof committeeMemberInputSchema>;

const committeeMembersArraySchema = z
  .array(committeeMemberInputSchema)
  .min(COMMITTEE_MEMBERS_MIN, 'El Comité de Calidad debe tener al menos un miembro')
  .max(
    COMMITTEE_MEMBERS_MAX,
    `El Comité de Calidad no puede superar los ${COMMITTEE_MEMBERS_MAX} miembros`,
  )
  .refine(
    (members) => members.filter((member) => member.position === 'PRESIDENT').length === 1,
    'El Comité de Calidad debe tener exactamente un Presidente',
  )
  .refine((members) => {
    const ids = members
      .map((member) => member.userId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    return new Set(ids).size === ids.length;
  }, 'Un mismo usuario no puede vincularse más de una vez en el mismo Comité')
  .refine((members) => {
    const emails = members
      .map((member) => member.userEmail)
      .filter((email): email is string => typeof email === 'string' && email.length > 0);
    return new Set(emails).size === emails.length;
  }, 'Un mismo correo no puede vincularse más de una vez en el mismo Comité');

export const registerQualityCommitteeRequestSchema = z
  .object({
    periodStart: calendarDateSchema('fecha de inicio'),
    periodEnd: calendarDateSchema('fecha de fin'),
    members: committeeMembersArraySchema,
  })
  .strict()
  .refine(
    (data) =>
      !ISO_DATE_PATTERN.test(data.periodStart) ||
      !ISO_DATE_PATTERN.test(data.periodEnd) ||
      data.periodStart <= data.periodEnd,
    {
      message: 'La fecha de inicio del periodo no puede ser posterior a la fecha de fin',
      path: ['periodEnd'],
    },
  );

export type RegisterQualityCommitteeRequest = z.infer<typeof registerQualityCommitteeRequestSchema>;

export const replaceCommitteeMembersRequestSchema = z
  .object({
    members: committeeMembersArraySchema,
  })
  .strict();

export type ReplaceCommitteeMembersRequest = z.infer<typeof replaceCommitteeMembersRequestSchema>;

export const qualityCommitteeIdParamSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(1, 'El identificador del Comité es obligatorio')
      .max(
        COMMITTEE_ID_MAX_LENGTH,
        `El identificador del Comité no puede superar los ${COMMITTEE_ID_MAX_LENGTH} caracteres`,
      ),
  })
  .strict();

export type QualityCommitteeIdParam = z.infer<typeof qualityCommitteeIdParamSchema>;

export const committeeMemberSchema = z
  .object({
    id: z.string().min(1),
    fullName: z.string().min(1),
    degree: z.string().min(1),
    position: committeeMemberPositionSchema,
    userId: z.string().nullable(),
    linkedUserName: z.string().nullable(),
  })
  .strict();

export type CommitteeMemberDto = z.infer<typeof committeeMemberSchema>;

export const qualityCommitteeSchema = z
  .object({
    id: z.string().min(1),
    periodStart: calendarDateSchema('fecha de inicio'),
    periodEnd: calendarDateSchema('fecha de fin'),
    isCurrent: z.boolean(),
    members: z.array(committeeMemberSchema),
  })
  .strict();

export type QualityCommitteeDto = z.infer<typeof qualityCommitteeSchema>;

export const actorCommitteeMembershipSchema = z
  .object({
    memberId: z.string().min(1),
    position: committeeMemberPositionSchema,
  })
  .strict();

export type ActorCommitteeMembershipDto = z.infer<typeof actorCommitteeMembershipSchema>;

export const presidentRoleAlertSchema = z
  .object({
    userId: z.string().min(1),
    fullName: z.string().min(1),
  })
  .strict();

export type PresidentRoleAlertDto = z.infer<typeof presidentRoleAlertSchema>;

export const currentQualityCommitteeResponseSchema = z
  .object({
    committee: qualityCommitteeSchema.nullable(),
    actorMembership: actorCommitteeMembershipSchema.nullable(),
    alerts: z.array(presidentRoleAlertSchema),
  })
  .strict();

export type CurrentQualityCommitteeResponse = z.infer<typeof currentQualityCommitteeResponseSchema>;

export const qualityCommitteeListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce
      .number()
      .int()
      .min(1)
      .max(COMMITTEE_LIST_PAGE_SIZE_MAX)
      .default(COMMITTEE_LIST_PAGE_SIZE_DEFAULT),
  })
  .strict();

export type QualityCommitteeListQuery = z.infer<typeof qualityCommitteeListQuerySchema>;

export const qualityCommitteeListResponseSchema = z
  .object({
    items: z.array(qualityCommitteeSchema),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1).max(COMMITTEE_LIST_PAGE_SIZE_MAX),
    total: z.number().int().nonnegative(),
  })
  .strict();

export type QualityCommitteeListResponse = z.infer<typeof qualityCommitteeListResponseSchema>;
