import { beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { seedAuthorization } from './seed/authorization-seed.js';
import { PrismaRoleReader } from './prisma-role-reader.js';

describe('PrismaRoleReader Integration (PostgreSQL real, A2.1, RS-010, LS 3.2)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const reader = new PrismaRoleReader({ get: () => prisma });

  beforeEach(async () => {
    await seedAuthorization(prisma);
  });

  it('lists predefined roles first and then by name', async () => {
    // Crear un rol custom no predefinido para comprobar el orden
    await prisma.role.create({
      data: {
        code: 'AAA_CUSTOM_ROLE',
        name: 'AAA Rol Personalizado',
        description: 'Rol personalizado de prueba',
        isPredefined: false,
        createdBy: 'TEST',
        updatedBy: 'TEST',
      },
    });

    const roles = await reader.listAll();

    expect(roles.length).toBeGreaterThanOrEqual(6);

    // Los primeros deben ser isPredefined === true
    const predefinedCount = roles.filter((r) => r.isPredefined).length;
    expect(predefinedCount).toBe(5);

    const first5 = roles.slice(0, 5);
    expect(first5.every((r) => r.isPredefined)).toBe(true);

    // Los roles no predefinidos van al final
    const remaining = roles.slice(5);
    expect(remaining.some((r) => r.code === 'AAA_CUSTOM_ROLE')).toBe(true);
    expect(remaining.every((r) => !r.isPredefined)).toBe(true);

    // Orden alfabético dentro de predefinidos
    const names = first5.map((r) => r.name);
    const sortedNames = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sortedNames);
  }, 15_000);

  it('returns only summary fields', async () => {
    const roles = await reader.listAll();
    expect(roles.length).toBeGreaterThan(0);

    for (const role of roles) {
      expect(role.id).toBeDefined();
      expect(role.code).toBeDefined();
      expect(role.name).toBeDefined();
      expect(typeof role.isPredefined).toBe('boolean');
      expect('description' in role).toBe(true);

      // Comprobar que no expone campos internos de auditoría ni relaciones
      expect('createdBy' in role).toBe(false);
      expect('updatedBy' in role).toBe(false);
      expect('createdAt' in role).toBe(false);
      expect('updatedAt' in role).toBe(false);
      expect('rolePermissions' in role).toBe(false);
      expect('userRoles' in role).toBe(false);
    }
  }, 15_000);
});
