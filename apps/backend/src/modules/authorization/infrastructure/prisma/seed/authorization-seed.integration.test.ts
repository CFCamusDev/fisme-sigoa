import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../../test/db/use-test-database.js';
import { seedAuthorization } from './authorization-seed.js';

describe('Authorization Seed Integration (PostgreSQL real, F3)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  it('seed creates roles, permissions and administrator grants', async () => {
    await seedAuthorization(prisma);

    // Verificar que los 5 roles predefinidos existan
    const roles = await prisma.role.findMany({
      orderBy: { code: 'asc' },
    });
    expect(roles).toHaveLength(5);
    const roleCodes = roles.map((r) => r.code);
    expect(roleCodes).toContain('ADMINISTRATOR');
    expect(roleCodes).toContain('COMMITTEE_PRESIDENT');
    expect(roleCodes).toContain('COMMITTEE_MEMBER');
    expect(roleCodes).toContain('PROGRAM_DIRECTOR');
    expect(roleCodes).toContain('TEACHER');

    // Verificar que los 4 permisos existan
    const permissions = await prisma.permission.findMany({
      orderBy: { code: 'asc' },
    });
    expect(permissions).toHaveLength(4);
    const permCodes = permissions.map((p) => p.code);
    expect(permCodes).toContain('usuario.ver');
    expect(permCodes).toContain('usuario.crear');
    expect(permCodes).toContain('usuario.editar');
    expect(permCodes).toContain('rol.ver');

    // Verificar que el Administrador tenga las 4 concesiones con alcance GLOBAL
    const adminRole = roles.find((r) => r.code === 'ADMINISTRATOR')!;
    const adminGrants = await prisma.rolePermission.findMany({
      where: { roleId: adminRole.id },
      include: { permission: true },
    });
    expect(adminGrants).toHaveLength(4);
    for (const grant of adminGrants) {
      expect(grant.scope).toBe('GLOBAL');
    }
  });

  it('seed is idempotent when executed multiple times', async () => {
    // Primera ejecución
    await seedAuthorization(prisma);
    const countRoles1 = await prisma.role.count();
    const countPerms1 = await prisma.permission.count();
    const countGrants1 = await prisma.rolePermission.count();

    // Segunda ejecución consecutiva
    await seedAuthorization(prisma);
    const countRoles2 = await prisma.role.count();
    const countPerms2 = await prisma.permission.count();
    const countGrants2 = await prisma.rolePermission.count();

    expect(countRoles2).toBe(countRoles1);
    expect(countPerms2).toBe(countPerms1);
    expect(countGrants2).toBe(countGrants1);
  });

  it('seed sets createdBy and updatedBy to SEED', async () => {
    await seedAuthorization(prisma);

    const roles = await prisma.role.findMany();
    for (const r of roles) {
      expect(r.createdBy).toBe('SEED');
      expect(r.updatedBy).toBe('SEED');
    }

    const permissions = await prisma.permission.findMany();
    for (const p of permissions) {
      expect(p.createdBy).toBe('SEED');
      expect(p.updatedBy).toBe('SEED');
    }

    const grants = await prisma.rolePermission.findMany();
    for (const g of grants) {
      expect(g.createdBy).toBe('SEED');
    }
  });
});
