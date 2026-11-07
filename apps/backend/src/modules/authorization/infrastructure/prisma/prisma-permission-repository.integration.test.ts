import { beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { PrismaPermissionRepository } from './prisma-permission-repository.js';
import { seedAuthorization } from './seed/authorization-seed.js';

describe('PrismaPermissionRepository Integration (PostgreSQL real, authorization module, HU-006, T-006-28)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const permissionRepo = new PrismaPermissionRepository(uow);

  beforeEach(async () => {
    await seedAuthorization(prisma);
  });

  it('lists the seeded catalog ordered by module and code', async () => {
    const permissions = await permissionRepo.findAll();
    expect(permissions).toHaveLength(72);

    for (let i = 0; i < permissions.length - 1; i++) {
      const current = permissions[i]!;
      const next = permissions[i + 1]!;
      const moduleComparison = current.module.localeCompare(next.module);
      if (moduleComparison === 0) {
        expect(current.code.localeCompare(next.code)).toBeLessThanOrEqual(0);
      } else {
        expect(moduleComparison).toBeLessThan(0);
      }
    }
  }, 15_000);

  it('maps id, code, description and module', async () => {
    const permissions = await permissionRepo.findByCodes(['usuario.ver']);
    expect(permissions).toHaveLength(1);

    const perm = permissions[0]!;
    expect(perm.id).toBeDefined();
    expect(perm.code).toBe('usuario.ver');
    expect(perm.description).toBe('Permite visualizar y listar los usuarios del sistema');
    expect(perm.module).toBe('M01 Seguridad');
  }, 15_000);

  it('finds permissions by codes and ignores unknown codes', async () => {
    const permissions = await permissionRepo.findByCodes([
      'usuario.ver',
      'rol.editar',
      'codigo.inexistente',
    ]);
    expect(permissions).toHaveLength(2);

    const codes = permissions.map((p) => p.code);
    expect(codes).toContain('usuario.ver');
    expect(codes).toContain('rol.editar');
    expect(codes).not.toContain('codigo.inexistente');
  }, 15_000);

  it('deduplicates repeated codes', async () => {
    const permissions = await permissionRepo.findByCodes([
      'usuario.ver',
      'usuario.ver',
      'rol.editar',
      'rol.editar',
    ]);
    expect(permissions).toHaveLength(2);
  }, 15_000);

  it('returns an empty list for no codes', async () => {
    expect(await permissionRepo.findByCodes([])).toEqual([]);
    expect(await permissionRepo.findByCodes(['   ', ''])).toEqual([]);
  }, 15_000);
});
