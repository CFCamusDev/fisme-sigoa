import { z } from 'zod';

export const USER_NAME_MAX_LENGTH = 100;
export const USER_EMAIL_MAX_LENGTH = 254;
export const DNI_PATTERN = /^\d{8}$/;
export const USER_ROLE_IDS_MAX = 10;
export const USERS_PAGE_SIZE_DEFAULT = 20;
export const USERS_PAGE_SIZE_MAX = 100;

export const userStatusSchema = z.enum(['PENDING_ACTIVATION', 'ACTIVE', 'INACTIVE']);
export type UserStatus = z.infer<typeof userStatusSchema>;

const emailSchema = z
  .string()
  .trim()
  .min(1, 'El correo electrónico es obligatorio')
  .max(
    USER_EMAIL_MAX_LENGTH,
    `El correo electrónico no puede exceder ${USER_EMAIL_MAX_LENGTH} caracteres`,
  )
  .email('El formato del correo electrónico es inválido')
  .transform((val) => val.toLowerCase());

const dniSchema = z
  .string()
  .trim()
  .regex(DNI_PATTERN, 'El DNI debe contener exactamente 8 dígitos numéricos');

const roleIdsSchema = z
  .array(z.string().min(1, 'El identificador de rol no puede estar vacío'))
  .min(1, 'Debe asignar al menos un rol al usuario')
  .max(USER_ROLE_IDS_MAX, `No se pueden asignar más de ${USER_ROLE_IDS_MAX} roles al usuario`)
  .refine((items) => new Set(items).size === items.length, {
    message: 'No se permiten identificadores de rol duplicados',
  });

export const createUserRequestSchema = z
  .object({
    names: z
      .string()
      .trim()
      .min(1, 'Los nombres son obligatorios')
      .max(
        USER_NAME_MAX_LENGTH,
        `Los nombres no pueden exceder ${USER_NAME_MAX_LENGTH} caracteres`,
      ),
    firstSurname: z
      .string()
      .trim()
      .min(1, 'El primer apellido es obligatorio')
      .max(
        USER_NAME_MAX_LENGTH,
        `El primer apellido no puede exceder ${USER_NAME_MAX_LENGTH} caracteres`,
      ),
    secondSurname: z
      .string()
      .trim()
      .max(
        USER_NAME_MAX_LENGTH,
        `El segundo apellido no puede exceder ${USER_NAME_MAX_LENGTH} caracteres`,
      )
      .nullable()
      .optional(),
    email: emailSchema,
    dni: dniSchema,
    roleIds: roleIdsSchema,
  })
  .strict();

export type CreateUserRequest = z.infer<typeof createUserRequestSchema>;

export const updateUserRequestSchema = z
  .object({
    names: z
      .string()
      .trim()
      .min(1, 'Los nombres no pueden estar vacíos')
      .max(USER_NAME_MAX_LENGTH, `Los nombres no pueden exceder ${USER_NAME_MAX_LENGTH} caracteres`)
      .optional(),
    firstSurname: z
      .string()
      .trim()
      .min(1, 'El primer apellido no puede estar vacío')
      .max(
        USER_NAME_MAX_LENGTH,
        `El primer apellido no puede exceder ${USER_NAME_MAX_LENGTH} caracteres`,
      )
      .optional(),
    secondSurname: z
      .string()
      .trim()
      .max(
        USER_NAME_MAX_LENGTH,
        `El segundo apellido no puede exceder ${USER_NAME_MAX_LENGTH} caracteres`,
      )
      .nullable()
      .optional(),
    email: emailSchema.optional(),
    dni: dniSchema.optional(),
    roleIds: roleIdsSchema.optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.names !== undefined ||
      data.firstSurname !== undefined ||
      data.secondSurname !== undefined ||
      data.email !== undefined ||
      data.dni !== undefined ||
      data.roleIds !== undefined,
    {
      message: 'Debe proporcionar al menos un campo para actualizar',
    },
  );

export type UpdateUserRequest = z.infer<typeof updateUserRequestSchema>;

export const changeUserStatusRequestSchema = z
  .object({
    status: z.enum(['ACTIVE', 'INACTIVE'], {
      message: 'El estado debe ser ACTIVE o INACTIVE',
    }),
  })
  .strict();

export type ChangeUserStatusRequest = z.infer<typeof changeUserStatusRequestSchema>;

export const listUsersQuerySchema = z
  .object({
    status: userStatusSchema.optional(),
    roleId: z.string().min(1).optional(),
    page: z.coerce.number().int().min(1, 'La página debe ser mayor o igual a 1').default(1),
    pageSize: z.coerce
      .number()
      .int()
      .min(1, 'El tamaño de página debe ser al menos 1')
      .max(USERS_PAGE_SIZE_MAX, `El tamaño de página no puede exceder ${USERS_PAGE_SIZE_MAX}`)
      .default(USERS_PAGE_SIZE_DEFAULT),
  })
  .strict();

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

export const userDtoSchema = z
  .object({
    id: z.string().min(1),
    names: z.string().min(1),
    firstSurname: z.string().min(1),
    secondSurname: z.string().nullable(),
    email: z.string().email(),
    dni: z.string().regex(DNI_PATTERN),
    status: userStatusSchema,
    roleIds: z.array(z.string()),
    lastLoginAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export type UserDto = z.infer<typeof userDtoSchema>;

export const listUsersResponseSchema = z
  .object({
    items: z.array(userDtoSchema),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(0),
  })
  .strict();

export type ListUsersResponse = z.infer<typeof listUsersResponseSchema>;
