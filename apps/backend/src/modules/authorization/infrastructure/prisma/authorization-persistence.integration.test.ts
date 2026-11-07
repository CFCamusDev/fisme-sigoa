import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { ValidationError } from '../../../../shared/errors/app-error.js';
import { PrismaGrantReader } from './prisma-grant-reader.js';
import { PrismaUserRoleGateway } from './prisma-user-role-gateway.js';

describe('Authorization Persistence Integration (PostgreSQL real, F3)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const grantReader = new PrismaGrantReader(uow);
  const roleGateway = new PrismaUserRoleGateway(uow);

  async function createFixture() {
    const user = await prisma.user.create({
      data: {
        names: 'Test',
        firstSurname: 'Auth',
        email: `persist.${Date.now()}-${Math.random()}@untrm.edu.pe`,
        dni: String(Math.floor(10000000 + Math.random() * 90000000)),
        status: 'ACTIVE',
      },
    });

    const role1 = await prisma.role.create({
      data: {
        code: `R1_${Date.now()}_${Math.random()}`,
        name: `Rol 1 ${Date.now()} ${Math.random()}`,
        isPredefined: false,
      },
    });

    const role2 = await prisma.role.create({
      data: {
        code: `R2_${Date.now()}_${Math.random()}`,
        name: `Rol 2 ${Date.now()} ${Math.random()}`,
        isPredefined: false,
      },
    });

    const suffix1 =
      Math.random()
        .toString(36)
        .replace(/[^a-z]/g, '')
        .slice(0, 6) || 'abc';
    const suffix2 =
      Math.random()
        .toString(36)
        .replace(/[^a-z]/g, '')
        .slice(0, 6) || 'def';

    const perm1 = await prisma.permission.create({
      data: {
        code: `permiso_${suffix1}.ver`,
        description: 'Perm 1',
        module: 'M01 Seguridad',
      },
    });

    const perm2 = await prisma.permission.create({
      data: {
        code: `permiso_${suffix2}.editar`,
        description: 'Perm 2',
        module: 'M01 Seguridad',
      },
    });

    await prisma.rolePermission.create({
      data: { roleId: role1.id, permissionId: perm1.id, scope: 'GLOBAL' },
    });
    await prisma.rolePermission.create({
      data: { roleId: role2.id, permissionId: perm2.id, scope: 'OWN' },
    });

    return { user, role1, role2, perm1, perm2 };
  }

  it('returns no grants for a user without roles', async () => {
    const { user } = await createFixture();
    const grants = await grantReader.findGrantsByUserId(user.id);
    expect(grants).toEqual([]);
  });

  it('reads grants through the roles of a user', async () => {
    const { user, role1, perm1 } = await createFixture();
    await roleGateway.replaceRoles(user.id, [role1.id]);

    const grants = await grantReader.findGrantsByUserId(user.id);
    expect(grants).toEqual([
      {
        permission: perm1.code,
        scope: 'GLOBAL',
      },
    ]);
  });

  it('applies a role change on the next read', async () => {
    const { user, role1, role2, perm2 } = await createFixture();
    await roleGateway.replaceRoles(user.id, [role1.id]);

    // Cambiar roles a role2
    await roleGateway.replaceRoles(user.id, [role2.id]);

    const grants = await grantReader.findGrantsByUserId(user.id);
    expect(grants).toEqual([
      {
        permission: perm2.code,
        scope: 'OWN',
      },
    ]);
  });

  it('replaces the roles of a user with exactly the given set', async () => {
    const { user, role1, role2 } = await createFixture();

    await roleGateway.replaceRoles(user.id, [role1.id, role2.id]);
    let roleMap = await roleGateway.getRoleIds([user.id]);
    expect(roleMap.get(user.id)).toHaveLength(2);

    // Reemplazar quitando role1
    await roleGateway.replaceRoles(user.id, [role2.id]);
    roleMap = await roleGateway.getRoleIds([user.id]);
    expect(roleMap.get(user.id)).toEqual([role2.id]);

    // Reemplazar vaciando roles
    await roleGateway.replaceRoles(user.id, []);
    roleMap = await roleGateway.getRoleIds([user.id]);
    expect(roleMap.get(user.id)).toEqual([]);
  });

  it('rejects unknown role ids without writing anything', async () => {
    const { user, role1 } = await createFixture();
    await roleGateway.replaceRoles(user.id, [role1.id]);

    await expect(
      roleGateway.replaceRoles(user.id, [role1.id, 'unknown-role-uuid']),
    ).rejects.toThrow(ValidationError);

    const roleMap = await roleGateway.getRoleIds([user.id]);
    expect(roleMap.get(user.id)).toEqual([role1.id]);
  });

  it('is idempotent when the set does not change', async () => {
    const { user, role1 } = await createFixture();
    await roleGateway.replaceRoles(user.id, [role1.id]);
    await roleGateway.replaceRoles(user.id, [role1.id]);

    const roleMap = await roleGateway.getRoleIds([user.id]);
    expect(roleMap.get(user.id)).toEqual([role1.id]);
  });

  it('returns an entry for every requested user, empty when it has no roles', async () => {
    const { user: user1, role1 } = await createFixture();
    const { user: user2 } = await createFixture();

    await roleGateway.replaceRoles(user1.id, [role1.id]);

    const roleMap = await roleGateway.getRoleIds([user1.id, user2.id, 'unregistered-user-id']);
    expect(roleMap.get(user1.id)).toEqual([role1.id]);
    expect(roleMap.get(user2.id)).toEqual([]);
    expect(roleMap.get('unregistered-user-id')).toEqual([]);
  });

  it('rolls back with the surrounding transaction', async () => {
    const { user, role1 } = await createFixture();

    await expect(
      uow.run(async () => {
        await roleGateway.replaceRoles(user.id, [role1.id]);
        throw new Error('Forced rollback');
      }),
    ).rejects.toThrow('Forced rollback');

    const roleMap = await roleGateway.getRoleIds([user.id]);
    expect(roleMap.get(user.id)).toEqual([]);
  });
});
