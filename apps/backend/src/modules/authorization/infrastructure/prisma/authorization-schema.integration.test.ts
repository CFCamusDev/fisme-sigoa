import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';

describe('Authorization Schema Integration (PostgreSQL real, F1)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  async function createBaseEntities(suffix: string) {
    const user = await prisma.user.create({
      data: {
        names: 'Test',
        firstSurname: 'User',
        email: `auth.schema.${suffix}@untrm.edu.pe`,
        dni: suffix.slice(0, 8),
        status: 'ACTIVE',
      },
    });

    const role = await prisma.role.create({
      data: {
        code: `ROLE_${suffix.toUpperCase()}`,
        name: `Rol de prueba ${suffix}`,
        description: 'Descripción de prueba',
        isPredefined: false,
      },
    });

    const permission = await prisma.permission.create({
      data: {
        code: `test.${suffix}.action`,
        description: 'Permiso de prueba',
        module: 'M01 Seguridad',
      },
    });

    return { user, role, permission };
  }

  it('prevents a duplicated role permission pair', async () => {
    const { role, permission } = await createBaseEntities('dup_rp');

    await prisma.rolePermission.create({
      data: {
        roleId: role.id,
        permissionId: permission.id,
        scope: 'GLOBAL',
      },
    });

    // Intentar duplicar la misma tupla [roleId, permissionId] debe fallar por clave única
    await expect(
      prisma.rolePermission.create({
        data: {
          roleId: role.id,
          permissionId: permission.id,
          scope: 'OWN',
        },
      }),
    ).rejects.toThrow();
  });

  it('prevents a duplicated user role pair', async () => {
    const { user, role } = await createBaseEntities('dup_ur');

    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: role.id,
      },
    });

    // Intentar duplicar la misma tupla [userId, roleId] debe fallar por clave única
    await expect(
      prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: role.id,
        },
      }),
    ).rejects.toThrow();
  });

  it('rejects unknown foreign keys', async () => {
    const { role, user } = await createBaseEntities('fk_err');

    // Clave foránea inexistente en roleId para userRole
    await expect(
      prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: 'non-existent-role-id',
        },
      }),
    ).rejects.toThrow();

    // Clave foránea inexistente en permissionId para rolePermission
    await expect(
      prisma.rolePermission.create({
        data: {
          roleId: role.id,
          permissionId: 'non-existent-permission-id',
        },
      }),
    ).rejects.toThrow();
  });

  it('does not allow deleting an assigned role (onDelete Restrict)', async () => {
    const { user, role } = await createBaseEntities('restrict');

    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: role.id,
      },
    });

    // Intentar borrar un rol asignado a un usuario debe ser rechazado por Restrict
    await expect(
      prisma.role.delete({
        where: { id: role.id },
      }),
    ).rejects.toThrow();
  });
});
