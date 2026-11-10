import type { PrismaClient } from '../../shared/prisma/generated/client.js';
import { seedAuthorization } from '../../modules/authorization/infrastructure/prisma/seed/authorization-seed.js';
import { deriveRoleCode } from '../../modules/authorization/domain/policies/derive-role-code.js';

export { seedAuthorization };
export { seedAuthorizationFast } from './authorization-fast.js';

export async function grantRole(
  prisma: PrismaClient,
  userId: string,
  roleCode: string,
): Promise<void> {
  const role = await prisma.role.findUniqueOrThrow({
    where: { code: roleCode },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId,
        roleId: role.id,
      },
    },
    update: {},
    create: {
      userId,
      roleId: role.id,
      createdBy: 'FACTORY',
    },
  });
}

export async function createRoleWithGrants(
  prisma: PrismaClient,
  options: {
    name: string;
    description?: string | null;
    grants?: Array<{ permissionCode: string; scope: 'GLOBAL' | 'OWN' }>;
    isPredefined?: boolean;
    status?: 'ACTIVE' | 'INACTIVE';
  },
): Promise<{ id: string; code: string; name: string }> {
  const code = deriveRoleCode(options.name);
  const role = await prisma.role.create({
    data: {
      name: options.name,
      code,
      description: options.description ?? null,
      isPredefined: options.isPredefined ?? false,
      status: options.status ?? 'ACTIVE',
      createdBy: 'FACTORY',
    },
  });

  if (options.grants && options.grants.length > 0) {
    for (const grant of options.grants) {
      const perm = await prisma.permission.findUniqueOrThrow({
        where: { code: grant.permissionCode },
      });
      await prisma.rolePermission.create({
        data: {
          roleId: role.id,
          permissionId: perm.id,
          scope: grant.scope,
          createdBy: 'FACTORY',
        },
      });
    }
  }

  return { id: role.id, code: role.code, name: role.name };
}
