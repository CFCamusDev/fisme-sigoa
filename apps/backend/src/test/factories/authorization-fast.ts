import type { PrismaClient } from '../../shared/prisma/generated/client.js';
import {
  CATALOG_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  PREDEFINED_ROLES,
} from '../../modules/authorization/domain/index.js';

/**
 * Siembra de autorización solo para pruebas (HU-078): deja las mismas filas que
 * `seedAuthorization` usando una sentencia SQL por tabla (`INSERT … SELECT … FROM unnest`) en lugar
 * de una consulta por fila. Respeta la misma regla: la matriz por defecto solo se concede si el rol
 * o el permiso son nuevos.
 *
 * Son tres etapas: leer lo existente, insertar roles y permisos en paralelo e insertar la matriz
 * resolviendo los identificadores por código dentro de la propia sentencia.
 */
export async function seedAuthorizationFast(prisma: PrismaClient): Promise<void> {
  const [existingRoles, existingPerms] = await Promise.all([
    prisma.role.findMany({ select: { code: true } }),
    prisma.permission.findMany({ select: { code: true } }),
  ]);
  const existingRoleCodes = new Set(existingRoles.map((r) => r.code));
  const existingPermCodes = new Set(existingPerms.map((p) => p.code));

  const newRoles = PREDEFINED_ROLES.filter((role) => !existingRoleCodes.has(role.code));
  const newPerms = CATALOG_PERMISSIONS.filter((perm) => !existingPermCodes.has(perm.code));
  const createdRoleCodes = new Set(newRoles.map((role) => role.code));
  const createdPermCodes = new Set(newPerms.map((perm) => perm.code));

  await Promise.all([
    newRoles.length > 0
      ? prisma.$executeRaw`
          INSERT INTO roles (id, code, name, description, "isPredefined", status, "createdBy", "updatedBy", "createdAt", "updatedAt")
          SELECT gen_random_uuid()::text, t.code, t.name, t.description, true, 'ACTIVE'::"RoleStatus", 'SEED', 'SEED', now(), now()
          FROM unnest(
            ${newRoles.map((role) => role.code)}::text[],
            ${newRoles.map((role) => role.name)}::text[],
            ${newRoles.map((role) => role.description)}::text[]
          ) AS t(code, name, description)
          ON CONFLICT DO NOTHING`
      : undefined,
    newPerms.length > 0
      ? prisma.$executeRaw`
          INSERT INTO permissions (id, code, description, module, "createdBy", "updatedBy", "createdAt", "updatedAt")
          SELECT gen_random_uuid()::text, t.code, t.description, t.module, 'SEED', 'SEED', now(), now()
          FROM unnest(
            ${newPerms.map((perm) => perm.code)}::text[],
            ${newPerms.map((perm) => perm.description)}::text[],
            ${newPerms.map((perm) => perm.module)}::text[]
          ) AS t(code, description, module)
          ON CONFLICT DO NOTHING`
      : undefined,
  ]);

  const grants = DEFAULT_ROLE_PERMISSIONS.filter(
    (grant) => createdRoleCodes.has(grant.roleCode) || createdPermCodes.has(grant.permissionCode),
  );
  if (grants.length === 0) return;

  await prisma.$executeRaw`
    INSERT INTO role_permissions (id, "roleId", "permissionId", scope, "createdBy", "createdAt", "updatedAt")
    SELECT gen_random_uuid()::text, r.id, p.id, g.scope::"PermissionScope", 'SEED', now(), now()
    FROM unnest(
      ${grants.map((grant) => grant.roleCode)}::text[],
      ${grants.map((grant) => grant.permissionCode)}::text[],
      ${grants.map((grant) => grant.scope)}::text[]
    ) AS g(role_code, permission_code, scope)
    JOIN roles r ON r.code = g.role_code
    JOIN permissions p ON p.code = g.permission_code
    ON CONFLICT DO NOTHING`;
}
