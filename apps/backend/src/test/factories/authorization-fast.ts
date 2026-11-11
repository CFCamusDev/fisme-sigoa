import type { PrismaClient } from '../../shared/prisma/generated/client.js';
import {
  CATALOG_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  PREDEFINED_ROLES,
} from '../../modules/authorization/domain/index.js';

/**
 * Siembra de autorización solo para pruebas (HU-078): deja las mismas filas que
 * `seedAuthorization` usando inserciones masivas en lugar de una consulta por fila.
 * Respeta la misma regla: la matriz por defecto solo se concede si el rol o el permiso son nuevos.
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

  if (newRoles.length > 0) {
    await prisma.role.createMany({
      data: newRoles.map((role) => ({
        code: role.code,
        name: role.name,
        description: role.description,
        isPredefined: true,
        status: 'ACTIVE' as const,
        createdBy: 'SEED',
        updatedBy: 'SEED',
      })),
      skipDuplicates: true,
    });
  }

  if (newPerms.length > 0) {
    await prisma.permission.createMany({
      data: newPerms.map((perm) => ({
        code: perm.code,
        description: perm.description,
        module: perm.module,
        createdBy: 'SEED',
        updatedBy: 'SEED',
      })),
      skipDuplicates: true,
    });
  }

  const grants = DEFAULT_ROLE_PERMISSIONS.filter(
    (grant) => createdRoleCodes.has(grant.roleCode) || createdPermCodes.has(grant.permissionCode),
  );
  if (grants.length === 0) return;

  const [allRoles, allPerms] = await Promise.all([
    prisma.role.findMany({ select: { id: true, code: true } }),
    prisma.permission.findMany({ select: { id: true, code: true } }),
  ]);
  const roleIdByCode = new Map(allRoles.map((r) => [r.code, r.id]));
  const permIdByCode = new Map(allPerms.map((p) => [p.code, p.id]));

  const data = grants.flatMap((grant) => {
    const roleId = roleIdByCode.get(grant.roleCode);
    const permissionId = permIdByCode.get(grant.permissionCode);
    return roleId && permissionId
      ? [{ roleId, permissionId, scope: grant.scope, createdBy: 'SEED' }]
      : [];
  });

  await prisma.rolePermission.createMany({ data, skipDuplicates: true });
}
