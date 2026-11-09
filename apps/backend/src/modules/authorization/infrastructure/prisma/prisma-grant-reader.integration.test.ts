import { beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import {
  createRoleWithGrants,
  grantRole,
  seedAuthorization,
} from '../../../../test/factories/authorization.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';
import { PrismaGrantReader } from './prisma-grant-reader.js';
import { PermissionAuthorizer } from '../../application/permission-authorizer.js';
import { ForbiddenError } from '../../../../shared/errors/app-error.js';

describe('PrismaGrantReader Integration (PostgreSQL real, HU-006, T-006-11, CA3, RF-006, RS-002)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const uow = new PrismaUnitOfWork(prisma);
  const grantReader = new PrismaGrantReader(uow);

  let userId: string;

  beforeEach(async () => {
    await seedAuthorization(prisma);

    const userActor = await createAuthenticatedActor({
      prisma,
      roles: [],
    });
    userId = userActor.user.id;
  });

  it('ignores the grants of inactive roles', async () => {
    const suffix = Date.now().toString().slice(-4);
    const inactiveRole = await createRoleWithGrants(prisma, {
      name: `Rol Inactivo ${suffix}`,
      status: 'INACTIVE',
      grants: [{ permissionCode: 'rol.ver', scope: 'GLOBAL' }],
    });

    await grantRole(prisma, userId, inactiveRole.code);

    const grants = await grantReader.findGrantsByUserId(userId);
    const hasInactiveGrant = grants.some((g) => g.permission === 'rol.ver');
    expect(hasInactiveGrant).toBe(false);
  });

  it('keeps the grants of the user other active roles', async () => {
    const suffix = Date.now().toString().slice(-4);
    const activeRole = await createRoleWithGrants(prisma, {
      name: `Rol Activo ${suffix}`,
      status: 'ACTIVE',
      grants: [{ permissionCode: 'usuario.ver', scope: 'GLOBAL' }],
    });

    const inactiveRole = await createRoleWithGrants(prisma, {
      name: `Rol Inactivo ${suffix}`,
      status: 'INACTIVE',
      grants: [{ permissionCode: 'rol.ver', scope: 'GLOBAL' }],
    });

    await grantRole(prisma, userId, activeRole.code);
    await grantRole(prisma, userId, inactiveRole.code);

    const grants = await grantReader.findGrantsByUserId(userId);
    expect(grants).toContainEqual({ permission: 'usuario.ver', scope: 'GLOBAL' });
    expect(grants.some((g) => g.permission === 'rol.ver')).toBe(false);
  });

  it('restores the grants when the role is reactivated', async () => {
    const suffix = Date.now().toString().slice(-4);
    const toggleRole = await createRoleWithGrants(prisma, {
      name: `Rol Toggle ${suffix}`,
      status: 'INACTIVE',
      grants: [{ permissionCode: 'catalogo.ver', scope: 'GLOBAL' }],
    });

    await grantRole(prisma, userId, toggleRole.code);

    // Inicialmente inactivo
    let grants = await grantReader.findGrantsByUserId(userId);
    expect(grants.some((g) => g.permission === 'catalogo.ver')).toBe(false);

    // Reactivar el rol
    await prisma.role.update({
      where: { id: toggleRole.id },
      data: { status: 'ACTIVE', deactivatedAt: null },
    });

    // En la siguiente lectura las concesiones deben estar disponibles
    grants = await grantReader.findGrantsByUserId(userId);
    expect(grants).toContainEqual({ permission: 'catalogo.ver', scope: 'GLOBAL' });
  });

  it('applies a direct OWN grant and removes access on the next read after revocation', async () => {
    const permission = await prisma.permission.findUniqueOrThrow({
      where: { code: 'usuario.ver' },
    });
    const direct = await prisma.userPermission.create({
      data: { userId, permissionId: permission.id, scope: 'OWN' },
    });
    const authorizer = new PermissionAuthorizer(grantReader);
    await expect(
      authorizer.assertAllowed({ actorId: userId, permission: permission.code, scope: 'OWN' }),
    ).resolves.toBeUndefined();
    await expect(
      authorizer.assertAllowed({ actorId: userId, permission: permission.code, scope: 'GLOBAL' }),
    ).rejects.toThrow(ForbiddenError);
    await prisma.user.update({ where: { id: userId }, data: { status: 'INACTIVE' } });
    expect(await grantReader.findGrantsByUserId(userId)).toContainEqual({
      permission: permission.code,
      scope: 'OWN',
    });
    await prisma.userPermission.delete({ where: { id: direct.id } });
    await expect(
      authorizer.assertAllowed({ actorId: userId, permission: permission.code, scope: 'OWN' }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('combines a direct GLOBAL grant with an active OWN role and ignores an inactive role', async () => {
    const active = await createRoleWithGrants(prisma, {
      name: 'Rol prueba propio',
      grants: [{ permissionCode: 'usuario.ver', scope: 'OWN' }],
    });
    const inactive = await createRoleWithGrants(prisma, {
      name: 'Rol prueba inactivo',
      status: 'INACTIVE',
      grants: [{ permissionCode: 'usuario.ver', scope: 'GLOBAL' }],
    });
    await grantRole(prisma, userId, active.code);
    await grantRole(prisma, userId, inactive.code);
    const permission = await prisma.permission.findUniqueOrThrow({
      where: { code: 'usuario.ver' },
    });
    const authorizer = new PermissionAuthorizer(grantReader);
    await expect(
      authorizer.assertAllowed({ actorId: userId, permission: permission.code, scope: 'GLOBAL' }),
    ).rejects.toThrow(ForbiddenError);
    await prisma.userPermission.create({
      data: { userId, permissionId: permission.id, scope: 'GLOBAL' },
    });
    expect(await grantReader.findGrantsByUserId(userId)).toEqual(
      expect.arrayContaining([
        { permission: permission.code, scope: 'OWN' },
        { permission: permission.code, scope: 'GLOBAL' },
      ]),
    );
    await expect(
      authorizer.assertAllowed({ actorId: userId, permission: permission.code, scope: 'GLOBAL' }),
    ).resolves.toBeUndefined();
    await prisma.role.update({ where: { id: active.id }, data: { status: 'INACTIVE' } });
    expect(await grantReader.findGrantsByUserId(userId)).toEqual([
      { permission: permission.code, scope: 'GLOBAL' },
    ]);
  });
});
