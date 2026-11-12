import { beforeEach, describe, expect, it } from 'vitest';
import { ValidationError } from '../../../../shared/errors/app-error.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import {
  createRoleWithGrants,
  grantRole,
  seedAuthorizationFast,
} from '../../../../test/factories/authorization.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';
import { PrismaUserRoleGateway } from './prisma-user-role-gateway.js';

describe('PrismaUserRoleGateway Integration (PostgreSQL real, HU-006, T-006-11, D4, RF-006)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const uow = new PrismaUnitOfWork(prisma);
  const gateway = new PrismaUserRoleGateway(uow);

  let userId: string;

  beforeEach(async () => {
    await seedAuthorizationFast(prisma);

    const userActor = await createAuthenticatedActor({
      prisma,
      roles: [],
    });
    userId = userActor.user.id;
  });

  it('rejects adding an inactive role with ValidationError', async () => {
    const suffix = Date.now().toString().slice(-4);
    const inactiveRole = await createRoleWithGrants(prisma, {
      name: `Rol Inactivo Asignar ${suffix}`,
      status: 'INACTIVE',
    });

    await expect(gateway.replaceRoles(userId, [inactiveRole.id])).rejects.toThrow(
      new ValidationError('No se puede asignar un rol inactivo'),
    );

    // No se insertó nada
    const assignments = await prisma.userRole.findMany({ where: { userId } });
    expect(assignments).toHaveLength(0);
  });

  it('keeps an inactive role already assigned without throwing', async () => {
    const suffix = Date.now().toString().slice(-4);
    const inactiveRole = await createRoleWithGrants(prisma, {
      name: `Rol Inactivo Previo ${suffix}`,
      status: 'INACTIVE',
    });

    // Asignación preexistente directa
    await grantRole(prisma, userId, inactiveRole.code);

    // Intentar reemplazar conservando ese mismo rol inactivo
    await expect(gateway.replaceRoles(userId, [inactiveRole.id])).resolves.not.toThrow();

    const assignments = await prisma.userRole.findMany({ where: { userId } });
    expect(assignments).toHaveLength(1);
    expect(assignments[0]!.roleId).toBe(inactiveRole.id);
  });

  it('accepts active roles and updates assignments', async () => {
    const suffix = Date.now().toString().slice(-4);
    const role1 = await createRoleWithGrants(prisma, {
      name: `Rol Activo 1 ${suffix}`,
      status: 'ACTIVE',
    });
    const role2 = await createRoleWithGrants(prisma, {
      name: `Rol Activo 2 ${suffix}`,
      status: 'ACTIVE',
    });

    await gateway.replaceRoles(userId, [role1.id, role2.id]);

    const assignments = await prisma.userRole.findMany({ where: { userId } });
    expect(assignments).toHaveLength(2);
    const assignedIds = assignments.map((a) => a.roleId);
    expect(assignedIds).toContain(role1.id);
    expect(assignedIds).toContain(role2.id);
  });
});
