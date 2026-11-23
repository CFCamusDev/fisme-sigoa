import type { Prisma, PrismaClient } from '../../../../../shared/prisma/generated/client.js';
import {
  CATALOG_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  PREDEFINED_ROLES,
} from '../../../domain/index.js';

export interface SeedAuthorizationOptions {
  readonly restorePredefined?: boolean;
}

type AuthorizationSeedDb = PrismaClient | Prisma.TransactionClient;

export async function seedAuthorization(
  prisma: AuthorizationSeedDb,
  options: SeedAuthorizationOptions = {},
): Promise<void> {
  const restorePredefined = options.restorePredefined === true;
  const predefinedCodes = new Set<string>(PREDEFINED_ROLES.map((role) => role.code));

  if (restorePredefined) {
    const manualRoles = await prisma.role.findMany({
      where: { code: { notIn: [...predefinedCodes] } },
      select: { id: true },
    });
    const manualRoleIds = manualRoles.map((role) => role.id);

    if (manualRoleIds.length > 0) {
      await prisma.userRole.deleteMany({
        where: { roleId: { in: manualRoleIds } },
      });
      await prisma.rolePermission.deleteMany({
        where: { roleId: { in: manualRoleIds } },
      });
      await prisma.role.deleteMany({
        where: { id: { in: manualRoleIds } },
      });
    }
  }

  // Identificar qué roles y permisos ya existen antes de sembrar
  const existingRoles = await prisma.role.findMany({
    select: { id: true, code: true },
  });
  const existingRoleCodes = new Set(existingRoles.map((r) => r.code));

  const existingPerms = await prisma.permission.findMany({
    select: { id: true, code: true },
  });
  const existingPermCodes = new Set(existingPerms.map((p) => p.code));

  const createdRoleCodes = new Set<string>();
  const createdPermCodes = new Set<string>();

  // 1. Roles predefinidos (LS 3.2): crear si no existen; en restauración restablecer oficial
  for (const role of PREDEFINED_ROLES) {
    if (!existingRoleCodes.has(role.code)) {
      await prisma.role.create({
        data: {
          code: role.code,
          name: role.name,
          description: role.description,
          isPredefined: true,
          status: 'ACTIVE',
          createdBy: 'SEED',
          updatedBy: 'SEED',
        },
      });
      createdRoleCodes.add(role.code);
    } else if (restorePredefined) {
      await prisma.role.update({
        where: { code: role.code },
        data: {
          name: role.name,
          description: role.description,
          isPredefined: true,
          status: 'ACTIVE',
          deactivatedAt: null,
          updatedBy: 'SEED',
        },
      });
    }
  }

  // 2. Permisos del catálogo (RS-010): upsert (descripción y módulo oficiales)
  for (const perm of CATALOG_PERMISSIONS) {
    const isNew = !existingPermCodes.has(perm.code);
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
    if (isNew) {
      createdPermCodes.add(perm.code);
    }
  }

  // Cargar mapas de roles y permisos
  const allRoles = await prisma.role.findMany({
    select: { id: true, code: true },
  });
  const roleIdByCode = new Map(allRoles.map((r) => [r.code, r.id]));

  const allPerms = await prisma.permission.findMany({
    select: { id: true, code: true },
  });
  const permIdByCode = new Map(allPerms.map((p) => [p.code, p.id]));

  if (restorePredefined) {
    const predefinedRoleIds = [...predefinedCodes]
      .map((code) => roleIdByCode.get(code))
      .filter((id): id is string => Boolean(id));
    if (predefinedRoleIds.length > 0) {
      await prisma.rolePermission.deleteMany({
        where: { roleId: { in: predefinedRoleIds } },
      });
    }
  }

  // 3. Matriz por defecto rol-permiso (LS 3.3):
  // Solo se insertan concesiones por defecto si el rol O el permiso fue creado en esta ejecución,
  // o si se solicitó restauración oficial de la matriz predefinida.
  for (const grant of DEFAULT_ROLE_PERMISSIONS) {
    const isRoleNew = createdRoleCodes.has(grant.roleCode);
    const isPermNew = createdPermCodes.has(grant.permissionCode);

    if (restorePredefined || isRoleNew || isPermNew) {
      const roleId = roleIdByCode.get(grant.roleCode);
      const permissionId = permIdByCode.get(grant.permissionCode);

      if (roleId && permissionId) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId,
              permissionId,
            },
          },
          update: {},
          create: {
            roleId,
            permissionId,
            scope: grant.scope,
            createdBy: 'SEED',
          },
        });
      }
    }
  }
}
