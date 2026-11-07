import { beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { seedAuthorization } from './seed/authorization-seed.js';
import { PrismaRoleReader } from './prisma-role-reader.js';

describe('PrismaRoleReader Integration (PostgreSQL real, A2.1, RS-010, LS 3.2, HU-006, T-006-12a)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const reader = new PrismaRoleReader({ get: () => prisma });

  beforeEach(async () => {
    await seedAuthorization(prisma);
  });

  it('lists the five predefined roles with their permissions and zero users', async () => {
    const roles = await reader.listAll();

    expect(roles.length).toBeGreaterThanOrEqual(5);

    const predefined = roles.filter((r) => r.isPredefined);
    expect(predefined).toHaveLength(5);

    for (const role of predefined) {
      expect(role.status).toBe('ACTIVE');
      expect(role.userCount).toBe(0);
      expect(role.deactivatedAt).toBeNull();
      expect(role.permissions).toBeInstanceOf(Array);
      expect(role.permissions.length).toBeGreaterThan(0);
      expect(role.updatedAt).toBeDefined();
    }
  }, 15_000);

  it('counts every assignment regardless of the user status', async () => {
    const role = await prisma.role.findUniqueOrThrow({
      where: { code: 'TEACHER' },
    });

    // Crear dos usuarios: uno ACTIVE y uno INACTIVE
    const activeUser = await prisma.user.create({
      data: {
        names: 'Docente Activo',
        firstSurname: 'Test',
        email: `docente.activo.${Date.now()}@untrm.edu.pe`,
        dni: String(Math.floor(10000000 + Math.random() * 90000000)),
        status: 'ACTIVE',
      },
    });

    const inactiveUser = await prisma.user.create({
      data: {
        names: 'Docente Inactivo',
        firstSurname: 'Test',
        email: `docente.inactivo.${Date.now()}@untrm.edu.pe`,
        dni: String(Math.floor(10000000 + Math.random() * 90000000)),
        status: 'INACTIVE',
      },
    });

    await prisma.userRole.createMany({
      data: [
        { userId: activeUser.id, roleId: role.id },
        { userId: inactiveUser.id, roleId: role.id },
      ],
    });

    const detailed = await reader.findById(role.id);
    expect(detailed).not.toBeNull();
    expect(detailed?.userCount).toBe(2);
  }, 15_000);

  it('orders predefined roles first and grants by code', async () => {
    await prisma.role.create({
      data: {
        code: 'AAA_CUSTOM_DETAILED',
        name: 'AAA Rol Personalizado',
        description: 'Rol personalizado de prueba',
        isPredefined: false,
        createdBy: 'TEST',
        updatedBy: 'TEST',
      },
    });

    const roles = await reader.listAll();

    expect(roles.length).toBeGreaterThanOrEqual(6);

    const first5 = roles.slice(0, 5);
    expect(first5.every((r) => r.isPredefined)).toBe(true);

    const names = first5.map((r) => r.name);
    const sortedNames = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sortedNames);

    const remaining = roles.slice(5);
    expect(remaining.some((r) => r.code === 'AAA_CUSTOM_DETAILED')).toBe(true);
    expect(remaining.every((r) => !r.isPredefined)).toBe(true);

    // Verificar que las concesiones de cada rol estén ordenadas alfabéticamente por código
    for (const r of roles) {
      const grantCodes = r.permissions.map((p) => p.permissionCode);
      const sortedGrants = [...grantCodes].sort((a, b) => a.localeCompare(b));
      expect(grantCodes).toEqual(sortedGrants);
    }
  }, 15_000);

  it('finds a role by id with its detail', async () => {
    const admin = await prisma.role.findUniqueOrThrow({
      where: { code: 'ADMINISTRATOR' },
    });

    const found = await reader.findById(admin.id);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(admin.id);
    expect(found?.code).toBe('ADMINISTRATOR');
    expect(found?.isPredefined).toBe(true);
    expect(found?.permissions.length).toBe(35);
  }, 15_000);

  it('returns null for an unknown id', async () => {
    expect(await reader.findById('non-existing-id')).toBeNull();
  }, 15_000);

  it('maps a null description and a null deactivation date', async () => {
    const created = await prisma.role.create({
      data: {
        code: `CUSTOM_NULL_${Date.now()}`,
        name: `Rol Nulo ${Date.now()}`,
        description: null,
        deactivatedAt: null,
        status: 'ACTIVE',
        isPredefined: false,
      },
    });

    const found = await reader.findById(created.id);
    expect(found).not.toBeNull();
    expect(found?.description).toBeNull();
    expect(found?.deactivatedAt).toBeNull();
    expect(found?.userCount).toBe(0);
    expect(found?.permissions).toEqual([]);
  }, 15_000);

  it('lists all roles returning detailed fields', async () => {
    const roles = await reader.listAll();
    expect(roles.length).toBeGreaterThanOrEqual(5);

    for (const role of roles) {
      expect(role.id).toBeDefined();
      expect(role.code).toBeDefined();
      expect(role.name).toBeDefined();
      expect(typeof role.isPredefined).toBe('boolean');
      expect(role.status).toBe('ACTIVE');
      expect(role.permissions).toBeInstanceOf(Array);
      expect(typeof role.userCount).toBe('number');
      expect(role.updatedAt).toBeDefined();
    }
  }, 15_000);
});
