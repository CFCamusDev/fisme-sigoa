import { z } from 'zod';
import {
  permissionScopeSchema,
  roleGrantSchema,
  roleGrantsListSchema,
  roleStatusSchema,
} from './roles.js';
import { roleIdsSchema, USER_ROLE_ID_MAX_LENGTH } from './users.js';

export const userIdParamSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(1, 'El identificador de usuario es obligatorio')
      .max(64, 'El identificador de usuario no puede exceder 64 caracteres'),
  })
  .strict();
export type UserIdParam = z.infer<typeof userIdParamSchema>;

export const assignUserRolesRequestSchema = z.object({ roleIds: roleIdsSchema }).strict();
export type AssignUserRolesRequest = z.infer<typeof assignUserRolesRequestSchema>;

export const assignUserPermissionsRequestSchema = z
  .object({ permissions: roleGrantsListSchema })
  .strict();
export type AssignUserPermissionsRequest = z.infer<typeof assignUserPermissionsRequestSchema>;

export const userAccessRoleSchema = z
  .object({
    id: z.string().min(1).max(USER_ROLE_ID_MAX_LENGTH),
    code: z.string().min(1),
    name: z.string().min(1),
    status: roleStatusSchema,
  })
  .strict();
export type UserAccessRole = z.infer<typeof userAccessRoleSchema>;

export const effectiveAccessSourceSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('ROLE'),
      roleId: z.string().min(1).max(USER_ROLE_ID_MAX_LENGTH),
      roleCode: z.string().min(1),
      roleName: z.string().min(1),
      scope: permissionScopeSchema,
    })
    .strict(),
  z.object({ kind: z.literal('DIRECT'), scope: permissionScopeSchema }).strict(),
]);
export type EffectiveAccessSource = z.infer<typeof effectiveAccessSourceSchema>;

export const effectiveAccessEntrySchema = roleGrantSchema
  .extend({
    sources: z
      .array(effectiveAccessSourceSchema)
      .min(1, 'El permiso debe tener al menos un origen'),
  })
  .strict();
export type EffectiveAccessEntry = z.infer<typeof effectiveAccessEntrySchema>;

export const userAccessSchema = z
  .object({
    userId: userIdParamSchema.shape.id,
    roles: z.array(userAccessRoleSchema),
    directPermissions: z.array(roleGrantSchema),
    effectivePermissions: z.array(effectiveAccessEntrySchema),
  })
  .strict();
export type UserAccessDto = z.infer<typeof userAccessSchema>;
