import type { PrismaClient } from '../../../../../shared/prisma/generated/client.js';
import {
  CATALOG_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  PREDEFINED_ROLES,
} from '../../../domain/index.js';

export async function seedAuthorization(prisma: PrismaClient): Promise<void> {
  // 1. Roles predefinidos (LS 3.2)
  for (const role of PREDEFINED_ROLES) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: {
        name: role.name,
        description: role.description,
        updatedBy: 'SEED',
      },
      create: {
        code: role.code,
        name: role.name,
        description: role.description,
        isPredefined: true,
        createdBy: 'SEED',
        updatedBy: 'SEED',
      },
    });
  }

  // 2. Permisos del catálogo (RS-010)
  for (const perm of CATALOG_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: {
        description: perm.description,
        module: perm.module,
        updatedBy: 'SEED',
      },
      create: {
        code: perm.code,
        description: perm.description,
        module: perm.module,
        createdBy: 'SEED',
        updatedBy: 'SEED',
      },
    });
  }

  // 3. Matriz por defecto rol-permiso (LS 3.3)
  for (const grant of DEFAULT_ROLE_PERMISSIONS) {
    const role = await prisma.role.findUniqueOrThrow({
      where: { code: grant.roleCode },
    });
    const perm = await prisma.permission.findUniqueOrThrow({
      where: { code: grant.permissionCode },
    });

    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: role.id,
          permissionId: perm.id,
        },
      },
      update: {
        scope: grant.scope,
      },
      create: {
        roleId: role.id,
        permissionId: perm.id,
        scope: grant.scope,
        createdBy: 'SEED',
      },
    });
  }
}
