import { beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { PrismaRolePermissionRepository } from './prisma-role-permission-repository.js';
import { PrismaRoleRepository } from './prisma-role-repository.js';
import { seedAuthorization } from './seed/authorization-seed.js';

describe('PrismaRolePermissionRepository Integration (PostgreSQL real, authorization module, HU-006, T-006-29)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const rolePermissionRepo = new PrismaRolePermissionRepository(uow);
  const roleRepo = new PrismaRoleRepository(uow);

  let perm1Id: string;
  let perm2Id: string;
  let perm3Id: string;

  beforeEach(async () => {
    await seedAuthorization(prisma);
    const p1 = await prisma.permission.findUniqueOrThrow({ where: { code: 'usuario.ver' } });
    const p2 = await prisma.permission.findUniqueOrThrow({ where: { code: 'usuario.crear' } });
    const p3 = await prisma.permission.findUniqueOrThrow({ where: { code: 'usuario.editar' } });
    perm1Id = p1.id;
    perm2Id = p2.id;
    perm3Id = p3.id;
  });

  async function createTestRole(id: string, name: string) {
    return prisma.role.create({
      data: {
        id,
        code: `CODE_${id.toUpperCase()}`,
        name,
        isPredefined: false,
      },
    });
  }

  it('returns the grants of a role with permission code and scope', async () => {
    const roleId = 'role-grant-test-1';
    await createTestRole(roleId, 'Rol Con Permisos');

    await prisma.rolePermission.create({
      data: {
        roleId,
        permissionId: perm2Id, // usuario.crear
        scope: 'OWN',
      },
    });

    await prisma.rolePermission.create({
      data: {
        roleId,
        permissionId: perm1Id, // usuario.ver
        scope: 'GLOBAL',
      },
    });

    const grants = await rolePermissionRepo.findByRoleId(roleId);
    expect(grants).toHaveLength(2);
    // Ordenado alfabéticamente por código de permiso
    expect(grants[0]).toEqual({
      permissionId: perm2Id,
      permissionCode: 'usuario.crear',
      scope: 'OWN',
    });
    expect(grants[1]).toEqual({
      permissionId: perm1Id,
      permissionCode: 'usuario.ver',
      scope: 'GLOBAL',
    });
  }, 15_000);

  it('returns an empty list for a role without grants', async () => {
    const roleId = 'role-grant-empty-2';
    await createTestRole(roleId, 'Rol Sin Permisos');

    const grants = await rolePermissionRepo.findByRoleId(roleId);
    expect(grants).toEqual([]);
  }, 15_000);

  it('replaces the set by adding, changing scope and removing', async () => {
    const roleId = 'role-replace-test-3';
    await createTestRole(roleId, 'Rol Para Reemplazo');

    // Estado inicial: perm1 GLOBAL, perm2 OWN
    await prisma.rolePermission.create({
      data: { roleId, permissionId: perm1Id, scope: 'GLOBAL' },
    });
    await prisma.rolePermission.create({
      data: { roleId, permissionId: perm2Id, scope: 'OWN' },
    });

    // Deseado: perm1 OWN (cambia scope), perm3 GLOBAL (nuevo), perm2 omitido (se elimina)
    const result = await uow.run(async () => {
      return rolePermissionRepo.replaceForRole(
        roleId,
        [
          { permissionId: perm1Id, scope: 'OWN' },
          { permissionId: perm3Id, scope: 'GLOBAL' },
        ],
        'actor-admin-1',
      );
    });

    expect(result).toEqual({ added: 1, updated: 1, removed: 1 });

    const updatedGrants = await rolePermissionRepo.findByRoleId(roleId);
    expect(updatedGrants).toHaveLength(2);
    expect(updatedGrants).toEqual([
      { permissionId: perm3Id, permissionCode: 'usuario.editar', scope: 'GLOBAL' },
      { permissionId: perm1Id, permissionCode: 'usuario.ver', scope: 'OWN' },
    ]);
  }, 15_000);

  it('leaves unchanged rows untouched and keeps updatedAt', async () => {
    const roleId = 'role-untouched-test-4';
    await createTestRole(roleId, 'Rol Intacto');

    const initialRow = await prisma.rolePermission.create({
      data: {
        roleId,
        permissionId: perm1Id,
        scope: 'GLOBAL',
        createdBy: 'initial-author',
        updatedBy: 'initial-author',
      },
    });

    const result = await uow.run(async () => {
      return rolePermissionRepo.replaceForRole(
        roleId,
        [
          { permissionId: perm1Id, scope: 'GLOBAL' }, // Sin cambios
          { permissionId: perm2Id, scope: 'OWN' }, // Nuevo
        ],
        'new-updater',
      );
    });

    expect(result).toEqual({ added: 1, updated: 0, removed: 0 });

    const afterRow = await prisma.rolePermission.findUniqueOrThrow({
      where: {
        roleId_permissionId: {
          roleId,
          permissionId: perm1Id,
        },
      },
    });

    expect(afterRow.id).toBe(initialRow.id);
    expect(afterRow.updatedAt.getTime()).toBe(initialRow.updatedAt.getTime());
    expect(afterRow.updatedBy).toBe('initial-author');
  }, 15_000);

  it('is idempotent when the desired set equals the current one', async () => {
    const roleId = 'role-idempotent-test-5';
    await createTestRole(roleId, 'Rol Idempotente');

    await prisma.rolePermission.create({
      data: { roleId, permissionId: perm1Id, scope: 'GLOBAL' },
    });

    const result = await uow.run(async () => {
      return rolePermissionRepo.replaceForRole(
        roleId,
        [{ permissionId: perm1Id, scope: 'GLOBAL' }],
        'actor-admin',
      );
    });

    expect(result).toEqual({ added: 0, updated: 0, removed: 0 });
  }, 15_000);

  it('records createdBy and updatedBy', async () => {
    const roleId = 'role-audit-test-6';
    await createTestRole(roleId, 'Rol Auditoria');

    await uow.run(async () => {
      return rolePermissionRepo.replaceForRole(
        roleId,
        [{ permissionId: perm1Id, scope: 'GLOBAL' }],
        'user-operator-99',
      );
    });

    const row = await prisma.rolePermission.findUniqueOrThrow({
      where: {
        roleId_permissionId: {
          roleId,
          permissionId: perm1Id,
        },
      },
    });

    expect(row.createdBy).toBe('user-operator-99');
    expect(row.updatedBy).toBe('user-operator-99');
  }, 15_000);

  it('rejects duplicated permissions in the desired set', async () => {
    const roleId = 'role-dup-test-7';
    await createTestRole(roleId, 'Rol Duplicados');

    await expect(
      uow.run(async () => {
        return rolePermissionRepo.replaceForRole(
          roleId,
          [
            { permissionId: perm1Id, scope: 'GLOBAL' },
            { permissionId: perm1Id, scope: 'OWN' },
          ],
          'admin',
        );
      }),
    ).rejects.toThrow('El conjunto deseado contiene permisos duplicados');
  }, 15_000);

  it('requires an active transaction', async () => {
    await expect(
      rolePermissionRepo.replaceForRole('role-1', [{ permissionId: 'p-1', scope: 'GLOBAL' }], 'a'),
    ).rejects.toThrow(
      'replaceForRole solo puede ejecutarse dentro de una transacción activa (UnitOfWork).',
    );
  }, 15_000);

  it('rolls back the whole replacement when a later step fails', async () => {
    const roleId = 'role-rollback-test-8';
    await createTestRole(roleId, 'Rol Rollback');

    await prisma.rolePermission.create({
      data: { roleId, permissionId: perm1Id, scope: 'GLOBAL' },
    });

    await expect(
      uow.run(async () => {
        await rolePermissionRepo.replaceForRole(
          roleId,
          [{ permissionId: perm2Id, scope: 'OWN' }],
          'admin',
        );
        throw new Error('Fallo provocado para rollback');
      }),
    ).rejects.toThrow('Fallo provocado para rollback');

    // Debe conservar el estado original (perm1 GLOBAL)
    const grants = await rolePermissionRepo.findByRoleId(roleId);
    expect(grants).toEqual([
      { permissionId: perm1Id, permissionCode: 'usuario.ver', scope: 'GLOBAL' },
    ]);
  }, 15_000);

  it('serializes two concurrent replacements behind the role lock', async () => {
    const roleId = 'role-concurrent-lock-9';
    await createTestRole(roleId, 'Rol Lock Concurrente');

    let tx1LockedNotify: () => void = () => {};
    const tx1LockedPromise = new Promise<void>((resolve) => {
      tx1LockedNotify = resolve;
    });

    let tx2AttemptNotify: () => void = () => {};
    const tx2AttemptPromise = new Promise<void>((resolve) => {
      tx2AttemptNotify = resolve;
    });

    const executionOrder: string[] = [];

    const tx1 = uow.run(async () => {
      const role = await roleRepo.findByIdForUpdate(roleId);
      expect(role).not.toBeNull();
      tx1LockedNotify();

      await tx2AttemptPromise;
      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });

      await rolePermissionRepo.replaceForRole(
        roleId,
        [{ permissionId: perm1Id, scope: 'GLOBAL' }],
        'admin-1',
      );
      executionOrder.push('tx1');
    });

    const tx2 = (async () => {
      await tx1LockedPromise;
      return uow.run(async () => {
        tx2AttemptNotify();
        const role = await roleRepo.findByIdForUpdate(roleId);
        expect(role).not.toBeNull();
        await rolePermissionRepo.replaceForRole(
          roleId,
          [{ permissionId: perm2Id, scope: 'OWN' }],
          'admin-2',
        );
        executionOrder.push('tx2');
      });
    })();

    await Promise.all([tx1, tx2]);

    expect(executionOrder).toEqual(['tx1', 'tx2']);
    const finalGrants = await rolePermissionRepo.findByRoleId(roleId);
    expect(finalGrants).toEqual([
      { permissionId: perm2Id, permissionCode: 'usuario.crear', scope: 'OWN' },
    ]);
  }, 20_000);
});
