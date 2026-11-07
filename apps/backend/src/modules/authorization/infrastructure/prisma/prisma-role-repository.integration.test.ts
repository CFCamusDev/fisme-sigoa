import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { PrismaRoleRepository } from './prisma-role-repository.js';
import { Role } from '../../domain/entities/role.js';
import { RoleAlreadyExistsError } from '../../domain/errors/role-already-exists-error.js';
import { RoleNotFoundError } from '../../domain/errors/role-not-found-error.js';

describe('PrismaRoleRepository Integration (PostgreSQL real, authorization module, HU-006, T-006-27)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const roleRepo = new PrismaRoleRepository(uow);

  it('adds a role and finds it by id, code and name', async () => {
    const role = Role.create({
      id: 'role-test-id-1',
      name: 'Auditor de Calidad',
      description: 'Rol para auditoría interna',
      createdBy: 'admin-seed-id',
    });

    await roleRepo.add(role);

    const byId = await roleRepo.findById('role-test-id-1');
    expect(byId).not.toBeNull();
    expect(byId?.id).toBe('role-test-id-1');
    expect(byId?.code).toBe('AUDITOR_DE_CALIDAD');
    expect(byId?.name).toBe('Auditor de Calidad');
    expect(byId?.description).toBe('Rol para auditoría interna');
    expect(byId?.status).toBe('ACTIVE');
    expect(byId?.isPredefined).toBe(false);
    expect(byId?.createdBy).toBe('admin-seed-id');
    expect(byId?.createdAt).toBeInstanceOf(Date);
    expect(byId?.updatedAt).toBeInstanceOf(Date);

    const byCode = await roleRepo.findByCode('AUDITOR_DE_CALIDAD');
    expect(byCode).not.toBeNull();
    expect(byCode?.id).toBe('role-test-id-1');

    const byName = await roleRepo.findByName('Auditor de Calidad');
    expect(byName).not.toBeNull();
    expect(byName?.id).toBe('role-test-id-1');
  }, 15_000);

  it('finds by name ignoring case', async () => {
    const role = Role.create({
      id: 'role-test-id-2',
      name: 'Coordinador de Escuela',
      description: 'Coordinación académica',
    });
    await roleRepo.add(role);

    const found = await roleRepo.findByName('   COORDINADOR DE ESCUELA   ');
    expect(found).not.toBeNull();
    expect(found?.id).toBe('role-test-id-2');
    expect(found?.name).toBe('Coordinador de Escuela');
  }, 15_000);

  it('returns null for unknown id, code and name', async () => {
    expect(await roleRepo.findById('unknown-id')).toBeNull();
    expect(await roleRepo.findByCode('UNKNOWN_CODE')).toBeNull();
    expect(await roleRepo.findByName('Rol Inexistente')).toBeNull();
  }, 15_000);

  it('maps a null description and a null deactivation date', async () => {
    const role = Role.create({
      id: 'role-test-id-3',
      name: 'Gestor Documental',
      description: null,
    });
    await roleRepo.add(role);

    const found = await roleRepo.findById('role-test-id-3');
    expect(found).not.toBeNull();
    expect(found?.description).toBeNull();
    expect(found?.deactivatedAt).toBeNull();
    expect(found?.status).toBe('ACTIVE');
  }, 15_000);

  it('rejects a duplicated code with RoleAlreadyExistsError', async () => {
    const role1 = Role.create({
      id: 'role-dup-code-1',
      name: 'Especialista Uno',
    });
    await roleRepo.add(role1);

    // Intentamos crear manualmente o con un rol restaurado que choque el código
    const role2 = Role.restore({
      id: 'role-dup-code-2',
      code: 'ESPECIALISTA_UNO',
      name: 'Especialista Distinto',
      description: null,
      status: 'ACTIVE',
      deactivatedAt: null,
      isPredefined: false,
      createdBy: null,
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(roleRepo.add(role2)).rejects.toThrow(RoleAlreadyExistsError);
  }, 15_000);

  it('rejects a duplicated name with RoleAlreadyExistsError', async () => {
    const role1 = Role.create({
      id: 'role-dup-name-1',
      name: 'Secretario General',
    });
    await roleRepo.add(role1);

    const role2 = Role.restore({
      id: 'role-dup-name-2',
      code: 'SECRETARIO_GENERAL_2',
      name: 'Secretario General',
      description: null,
      status: 'ACTIVE',
      deactivatedAt: null,
      isPredefined: false,
      createdBy: null,
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(roleRepo.add(role2)).rejects.toThrow(RoleAlreadyExistsError);
  }, 15_000);

  it('findByIdForUpdate requires an active transaction', async () => {
    await expect(roleRepo.findByIdForUpdate('any-id')).rejects.toThrow(
      'findByIdForUpdate solo puede ejecutarse dentro de una transacción activa (UnitOfWork).',
    );
  }, 15_000);

  it('findByIdForUpdate makes a second transaction wait for the first one', async () => {
    const id = 'role-lock-test-id';
    const role = Role.create({
      id,
      name: 'Rol Bloqueado',
      description: 'Inicial',
    });
    await roleRepo.add(role);

    let tx1ReadNotify: () => void = () => {};
    const tx1ReadPromise = new Promise<void>((resolve) => {
      tx1ReadNotify = resolve;
    });

    let tx2AttemptNotify: () => void = () => {};
    const tx2AttemptPromise = new Promise<void>((resolve) => {
      tx2AttemptNotify = resolve;
    });

    const executionOrder: string[] = [];

    const tx1 = uow.run(async () => {
      const r1 = await roleRepo.findByIdForUpdate(id);
      expect(r1).not.toBeNull();
      tx1ReadNotify();

      await tx2AttemptPromise;
      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });

      await (uow.get() as typeof prisma).role.update({
        where: { id },
        data: { description: 'Updated By Tx1' },
      });
      executionOrder.push('tx1');
    });

    const tx2 = (async () => {
      await tx1ReadPromise;
      return uow.run(async () => {
        tx2AttemptNotify();
        const r2 = await roleRepo.findByIdForUpdate(id);
        expect(r2).not.toBeNull();
        expect(r2?.description).toBe('Updated By Tx1');
        executionOrder.push('tx2');
      });
    })();

    await Promise.all([tx1, tx2]);

    expect(executionOrder).toEqual(['tx1', 'tx2']);
    const finalInDb = await prisma.role.findUniqueOrThrow({ where: { id } });
    expect(finalInDb.description).toBe('Updated By Tx1');
  }, 20_000);

  it('only one of N concurrent creations of the same role wins', async () => {
    const roles = Array.from({ length: 5 }, (_, i) =>
      Role.create({
        id: `concurrent-role-id-${i}`,
        name: 'Rol Concurrente Unico',
        description: `Intento ${i}`,
      }),
    );

    const results = await Promise.allSettled(roles.map((r) => roleRepo.add(r)));

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(4);
    for (const rej of rejected) {
      if (rej.status === 'rejected') {
        expect(rej.reason).toBeInstanceOf(RoleAlreadyExistsError);
      }
    }
  }, 20_000);

  describe('save (HU-006, N2b, T-006-07, RF-006)', () => {
    it('saves name, description and status', async () => {
      const id = 'role-save-test-id';
      const role = Role.create({
        id,
        name: 'Rol Inicial Para Guardar',
        description: 'Descripción inicial',
      });
      await roleRepo.add(role);

      const deactDate = new Date('2026-11-06T19:30:00.000Z');
      role.applyChanges(
        {
          name: 'Rol Con Nombre Actualizado',
          description: 'Descripción actualizada',
        },
        'admin-actor-uuid',
      );
      role.deactivate('admin-actor-uuid', deactDate);

      await roleRepo.save(role);

      const saved = await roleRepo.findById(id);
      expect(saved).not.toBeNull();
      expect(saved?.name).toBe('Rol Con Nombre Actualizado');
      expect(saved?.description).toBe('Descripción actualizada');
      expect(saved?.status).toBe('INACTIVE');
      expect(saved?.deactivatedAt).toEqual(deactDate);
      expect(saved?.updatedBy).toBe('admin-actor-uuid');
    }, 15_000);

    it('rejects a duplicated name with RoleAlreadyExistsError', async () => {
      const roleA = Role.create({
        id: 'role-save-dup-a',
        name: 'Nombre Existente Para Choque',
      });
      await roleRepo.add(roleA);

      const roleB = Role.create({
        id: 'role-save-dup-b',
        name: 'Nombre Secundario',
      });
      await roleRepo.add(roleB);

      roleB.applyChanges({ name: 'Nombre Existente Para Choque' }, 'admin-actor-uuid');

      await expect(roleRepo.save(roleB)).rejects.toThrow(RoleAlreadyExistsError);
    }, 15_000);

    it('fails with not found when the row disappeared', async () => {
      const roleGhost = Role.restore({
        id: 'role-ghost-id-404',
        code: 'ROLE_GHOST',
        name: 'Rol Fantasma',
        description: null,
        status: 'ACTIVE',
        deactivatedAt: null,
        isPredefined: false,
        createdBy: null,
        updatedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(roleRepo.save(roleGhost)).rejects.toThrow(RoleNotFoundError);
    }, 15_000);
  });
});
