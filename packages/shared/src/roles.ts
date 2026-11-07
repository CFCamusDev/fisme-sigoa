import { z } from 'zod';

export const ROLE_NAME_MIN_LENGTH = 3;
export const ROLE_NAME_MAX_LENGTH = 80;
export const ROLE_DESCRIPTION_MAX_LENGTH = 255;
export const ROLE_ID_MAX_LENGTH = 64;
export const ROLE_PERMISSIONS_MAX = 200;
export const PERMISSION_CODE_MAX_LENGTH = 64;
export const PERMISSION_CODE_PATTERN = /^[a-z]+(_[a-z]+)*\.[a-z]+(_[a-z]+)*$/;

export const permissionScopeSchema = z.enum(['GLOBAL', 'OWN']);
export type PermissionScope = z.infer<typeof permissionScopeSchema>;

export const roleStatusSchema = z.enum(['ACTIVE', 'INACTIVE']);
export type RoleStatus = z.infer<typeof roleStatusSchema>;

export const roleSummarySchema = z
  .object({
    id: z.string().min(1, 'El identificador de rol es requerido'),
    code: z.string().min(1, 'El código de rol es requerido'),
    name: z.string().min(1, 'El nombre de rol es requerido'),
    description: z.string().nullable(),
    isPredefined: z.boolean(),
  })
  .strict();

export type RoleSummary = z.infer<typeof roleSummarySchema>;

export const roleGrantSchema = z
  .object({
    permissionCode: z
      .string()
      .trim()
      .max(
        PERMISSION_CODE_MAX_LENGTH,
        `El código de permiso no puede exceder ${PERMISSION_CODE_MAX_LENGTH} caracteres`,
      )
      .regex(
        PERMISSION_CODE_PATTERN,
        'El código de permiso debe tener el formato recurso.accion en minúsculas',
      ),
    scope: permissionScopeSchema,
  })
  .strict();

export type RoleGrant = z.infer<typeof roleGrantSchema>;

const roleNameSchema = z
  .string()
  .transform((val) => val.trim().replace(/\s+/g, ' '))
  .pipe(
    z
      .string()
      .min(
        ROLE_NAME_MIN_LENGTH,
        `El nombre de rol debe tener al menos ${ROLE_NAME_MIN_LENGTH} caracteres`,
      )
      .max(
        ROLE_NAME_MAX_LENGTH,
        `El nombre de rol no puede exceder ${ROLE_NAME_MAX_LENGTH} caracteres`,
      ),
  );

const roleDescriptionSchema = z
  .string()
  .trim()
  .max(
    ROLE_DESCRIPTION_MAX_LENGTH,
    `La descripción no puede exceder ${ROLE_DESCRIPTION_MAX_LENGTH} caracteres`,
  )
  .nullable()
  .optional()
  .transform((val) => (val === undefined ? undefined : val === null || val === '' ? null : val));

const roleGrantsListSchema = z
  .array(roleGrantSchema)
  .max(ROLE_PERMISSIONS_MAX, `No se pueden asignar más de ${ROLE_PERMISSIONS_MAX} permisos al rol`)
  .refine((items) => new Set(items.map((i) => i.permissionCode)).size === items.length, {
    message: 'No se permiten códigos de permiso duplicados',
  });

export const createRoleRequestSchema = z
  .object({
    name: roleNameSchema,
    description: roleDescriptionSchema,
    permissions: roleGrantsListSchema.default([]),
  })
  .strict();

export type CreateRoleRequest = z.infer<typeof createRoleRequestSchema>;

export const updateRolePermissionsRequestSchema = z
  .object({
    permissions: roleGrantsListSchema,
  })
  .strict();

export type UpdateRolePermissionsRequest = z.infer<typeof updateRolePermissionsRequestSchema>;

export const roleDtoSchema = z
  .object({
    id: z.string().min(1, 'El identificador de rol es requerido').max(ROLE_ID_MAX_LENGTH),
    code: z.string().min(1, 'El código de rol es requerido'),
    name: z.string().min(ROLE_NAME_MIN_LENGTH).max(ROLE_NAME_MAX_LENGTH),
    description: z.string().nullable(),
    isPredefined: z.boolean(),
    status: roleStatusSchema,
    deactivatedAt: z.string().nullable(),
    userCount: z
      .number()
      .int('La cantidad de usuarios debe ser un número entero')
      .min(0, 'La cantidad de usuarios debe ser mayor o igual a cero'),
    permissions: z.array(roleGrantSchema),
    updatedAt: z.string(),
  })
  .strict();

export type RoleDto = z.infer<typeof roleDtoSchema>;

export const listRolesResponseSchema = z
  .object({
    items: z.array(roleDtoSchema),
  })
  .strict();

export type ListRolesResponse = z.infer<typeof listRolesResponseSchema>;

export const permissionDtoSchema = z
  .object({
    code: z.string().min(1, 'El código de permiso es requerido'),
    description: z.string().min(1, 'La descripción de permiso es requerida'),
    module: z.string().min(1, 'El módulo de permiso es requerido'),
  })
  .strict();

export type PermissionDto = z.infer<typeof permissionDtoSchema>;

export const listPermissionsResponseSchema = z
  .object({
    items: z.array(permissionDtoSchema),
  })
  .strict();

export type ListPermissionsResponse = z.infer<typeof listPermissionsResponseSchema>;

export const roleIdParamSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(1, 'El identificador de rol es requerido')
      .max(
        ROLE_ID_MAX_LENGTH,
        `El identificador de rol no puede exceder ${ROLE_ID_MAX_LENGTH} caracteres`,
      ),
  })
  .strict();

export type RoleIdParam = z.infer<typeof roleIdParamSchema>;

export const updateRoleRequestSchema = z
  .object({
    name: roleNameSchema.optional(),
    description: roleDescriptionSchema.optional(),
  })
  .strict()
  .refine((data) => data.name !== undefined || data.description !== undefined, {
    message: 'Se debe proporcionar al menos el nombre o la descripción para actualizar el rol',
  });

export type UpdateRoleRequest = z.infer<typeof updateRoleRequestSchema>;

export const changeRoleStatusRequestSchema = z
  .object({
    status: roleStatusSchema,
    confirmed: z.boolean().optional(),
  })
  .strict();

export type ChangeRoleStatusRequest = z.infer<typeof changeRoleStatusRequestSchema>;
