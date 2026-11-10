import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '../../shared/prisma/generated/client.js';
import { seedAuthorization } from '../../modules/authorization/infrastructure/prisma/seed/authorization-seed.js';
import { resetDatabase } from '../db/reset-database.js';
import { useTestDatabase } from '../db/use-test-database.js';
import { seedAuthorizationFast } from './authorization-fast.js';

/** Filas de autorización sin `id` ni marcas de tiempo (D2 del plan HU-078). */
async function snapshotAuthorization(prisma: PrismaClient) {
  const roles = await prisma.role.findMany({ orderBy: { code: 'asc' } });
  const permissions = await prisma.permission.findMany({ orderBy: { code: 'asc' } });
  const roleCodeById = new Map(roles.map((r) => [r.id, r.code]));
  const permCodeById = new Map(permissions.map((p) => [p.id, p.code]));
  const grants = await prisma.rolePermission.findMany();

  return {
    roles: roles.map(({ id: _id, createdAt: _c, updatedAt: _u, ...rest }) => rest),
    permissions: permissions.map(({ id: _id, createdAt: _c, updatedAt: _u, ...rest }) => rest),
    grants: grants
      .map(({ id: _id, createdAt: _c, updatedAt: _u, roleId, permissionId, ...rest }) => ({
        ...rest,
        roleCode: roleCodeById.get(roleId),
        permissionCode: permCodeById.get(permissionId),
      }))
      .sort((a, b) =>
        `${a.roleCode}/${a.permissionCode}`.localeCompare(`${b.roleCode}/${b.permissionCode}`),
      ),
  };
}

describe('seedAuthorizationFast (T-078-03, CA1)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  it('leaves the same rows as seedAuthorization', async () => {
    await seedAuthorization(prisma);
    const original = await snapshotAuthorization(prisma);
    expect(original.roles).toHaveLength(5);
    expect(original.permissions).toHaveLength(72);
    expect(original.grants.length).toBeGreaterThan(0);

    await resetDatabase();
    await seedAuthorizationFast(prisma);
    const fast = await snapshotAuthorization(prisma);

    expect(fast).toEqual(original);
  });

  it('is idempotent and keeps a role edited after the first seed', async () => {
    await seedAuthorizationFast(prisma);
    await prisma.role.update({ where: { code: 'TEACHER' }, data: { description: 'Editada' } });
    const grantsBefore = await prisma.rolePermission.count();

    await seedAuthorizationFast(prisma);

    expect(await prisma.rolePermission.count()).toBe(grantsBefore);
    expect(await prisma.role.count()).toBe(5);
    const teacher = await prisma.role.findUniqueOrThrow({ where: { code: 'TEACHER' } });
    expect(teacher.description).toBe('Editada');
  });

  it('seeds in 100 ms or less', async () => {
    // Calienta la conexión: la medición es de la siembra, no del primer acceso.
    await prisma.role.count();

    // Mejor de 5 siembras sobre base vacía: descarta el ruido de una máquina saturada
    // (verificación con grupos en paralelo) sin ocultar una siembra realmente lenta.
    const timings: number[] = [];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await resetDatabase();
      const started = performance.now();
      await seedAuthorizationFast(prisma);
      timings.push(performance.now() - started);
    }

    expect(await prisma.permission.count()).toBe(72);
    expect(Math.min(...timings)).toBeLessThanOrEqual(100);
  }, 30_000);
});
