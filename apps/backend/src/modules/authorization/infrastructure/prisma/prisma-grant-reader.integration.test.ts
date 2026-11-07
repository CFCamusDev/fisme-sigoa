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
});
