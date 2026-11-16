import { describe, expect, it } from 'vitest';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { Stakeholder } from '../../domain/entities/stakeholder.js';
import { DuplicateStakeholderError } from '../../domain/errors/index.js';
import { PrismaStakeholderRepository } from './prisma-stakeholder-repository.js';

describe('PrismaStakeholderRepository Integration (PostgreSQL real, T-021-24)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const repository = new PrismaStakeholderRepository(uow);

  const NOW = new Date('2026-11-16T10:00:00.000Z');
  const LATER = new Date('2026-11-16T11:00:00.000Z');

  function makePerson(id: string, dni: string, overrides: { email?: string | null } = {}) {
    return Stakeholder.register({
      id,
      kind: 'PERSON',
      fullName: `Persona ${id}`,
      dni,
      email: overrides.email ?? null,
      actorId: 'user-1',
      now: NOW,
    });
  }

  function makeInstitution(id: string, ruc: string) {
    return Stakeholder.register({
      id,
      kind: 'INSTITUTION',
      fullName: `Institucion ${id}`,
      ruc,
      actorId: 'user-1',
      now: NOW,
    });
  }

  it('persists and reads back a person', async () => {
    const person = makePerson('stk-p1', '45678901');
    await repository.save(person);

    const found = await repository.findById('stk-p1');
    expect(found).not.toBeNull();
    expect(found?.kind).toBe('PERSON');
    expect(found?.fullName).toBe('Persona stk-p1');
    expect(found?.dni).toBe('45678901');
    expect(found?.ruc).toBeNull();
    expect(found?.email).toBeNull();
    expect(found?.mobile).toBeNull();
    expect(found?.status).toBe('ACTIVE');
    expect(await repository.findById('missing-id')).toBeNull();
  }, 5_000);

  it('rejects a duplicate DNI or RUC and lets the caller find the existing record', async () => {
    await repository.save(makePerson('stk-d1', '12345678', { email: 'uno@example.com' }));
    await repository.save(makeInstitution('stk-i1', '20123456789'));

    await expect(repository.save(makePerson('stk-d2', '12345678'))).rejects.toBeInstanceOf(
      DuplicateStakeholderError,
    );
    await expect(repository.save(makeInstitution('stk-i2', '20123456789'))).rejects.toBeInstanceOf(
      DuplicateStakeholderError,
    );

    const existingPerson = await prisma.stakeholder.findUnique({ where: { dni: '12345678' } });
    expect(existingPerson?.id).toBe('stk-d1');

    const existingInstitution = await prisma.stakeholder.findUnique({
      where: { ruc: '20123456789' },
    });
    expect(existingInstitution?.id).toBe('stk-i1');
  }, 5_000);

  it('keeps DNI uniqueness even when the existing stakeholder is voided', async () => {
    const person = makePerson('stk-v1', '87654321');
    await repository.save(person);

    const voided = person.void({
      reason: 'Registro anulado para verificar unicidad historica',
      actorId: 'user-2',
      now: LATER,
    });
    const updated = await repository.saveChanges(voided, 'ACTIVE');
    expect(updated).toBe(true);

    await expect(repository.save(makePerson('stk-v2', '87654321'))).rejects.toBeInstanceOf(
      DuplicateStakeholderError,
    );
  }, 5_000);

  it('lets exactly one of N concurrent saves of the same document win', async () => {
    const attempts = ['c1', 'c2', 'c3', 'c4', 'c5'].map((id) =>
      repository.save(makePerson(id, '99887766')),
    );

    const results = await Promise.allSettled(attempts);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    expect(rejected).toHaveLength(4);
    for (const result of rejected) {
      expect(result.reason).toBeInstanceOf(DuplicateStakeholderError);
    }
    expect(await prisma.stakeholder.count({ where: { dni: '99887766' } })).toBe(1);
  }, 5_000);

  it('lets exactly one of N concurrent void updates win', async () => {
    const person = makePerson('stk-cv1', '55443322');
    await repository.save(person);

    const active = await repository.findById('stk-cv1');
    expect(active).not.toBeNull();

    const attempts = Array.from({ length: 5 }, (_, index) => {
      const voided = active!.void({
        reason: `Anulacion concurrente intento ${index + 1}`,
        actorId: `user-${index + 1}`,
        now: LATER,
      });
      return repository.saveChanges(voided, 'ACTIVE');
    });

    const results = await Promise.all(attempts);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(results.filter((updated) => !updated)).toHaveLength(4);

    const finalState = await repository.findById('stk-cv1');
    expect(finalState?.status).toBe('VOIDED');
  }, 5_000);

  it('lists stakeholders ordered by name with pagination', async () => {
    await repository.save(
      Stakeholder.register({
        id: 'stk-l3',
        kind: 'PERSON',
        fullName: 'Carlos Vega',
        dni: '11111113',
        actorId: 'user-1',
        now: NOW,
      }),
    );
    await repository.save(
      Stakeholder.register({
        id: 'stk-l1',
        kind: 'PERSON',
        fullName: 'Ana Alvarez',
        dni: '11111111',
        actorId: 'user-1',
        now: NOW,
      }),
    );
    await repository.save(
      Stakeholder.register({
        id: 'stk-l2',
        kind: 'INSTITUTION',
        fullName: 'Boreal Tech SAC',
        ruc: '20111111112',
        actorId: 'user-1',
        now: NOW,
      }),
    );

    const page1 = await repository.list({ page: 1, pageSize: 2 });
    expect(page1.total).toBe(3);
    expect(page1.items.map((item) => item.fullName)).toEqual(['Ana Alvarez', 'Boreal Tech SAC']);

    const page2 = await repository.list({ page: 2, pageSize: 2 });
    expect(page2.total).toBe(3);
    expect(page2.items.map((item) => item.fullName)).toEqual(['Carlos Vega']);
  }, 5_000);

  it('filters by kind, status and exact document', async () => {
    const pActive = makePerson('stk-f1', '22222221');
    const pVoided = makePerson('stk-f2', '22222222').void({
      reason: 'Registro anulado para probar filtros de estado',
      actorId: 'user-2',
      now: LATER,
    });
    const inst = makeInstitution('stk-f3', '20222222223');

    await repository.save(pActive);
    await repository.save(pVoided);
    await repository.save(inst);

    const onlyPersons = await repository.list({ kind: 'PERSON', page: 1, pageSize: 10 });
    expect(onlyPersons.total).toBe(2);

    const activePersons = await repository.list({
      kind: 'PERSON',
      status: 'ACTIVE',
      page: 1,
      pageSize: 10,
    });
    expect(activePersons.total).toBe(1);
    expect(activePersons.items[0]?.id).toBe('stk-f1');

    const byRuc = await repository.list({ document: '20222222223', page: 1, pageSize: 10 });
    expect(byRuc.total).toBe(1);
    expect(byRuc.items[0]?.id).toBe('stk-f3');
  }, 5_000);

  it('finds a voided stakeholder by its exact document', async () => {
    const voided = makePerson('stk-fv1', '33333331').void({
      reason: 'Anulado pero localizable por documento exacto',
      actorId: 'user-2',
      now: LATER,
    });
    await repository.save(voided);

    const result = await repository.list({ document: '33333331', page: 1, pageSize: 10 });
    expect(result.total).toBe(1);
    expect(result.items[0]?.id).toBe('stk-fv1');
    expect(result.items[0]?.status).toBe('VOIDED');
  }, 5_000);

  it('searches by name, DNI or RUC and treats wildcard characters literally', async () => {
    await repository.save(
      Stakeholder.register({
        id: 'stk-w1',
        kind: 'INSTITUTION',
        fullName: '100% Real_Corp SAC',
        ruc: '20444444441',
        actorId: 'user-1',
        now: NOW,
      }),
    );
    await repository.save(
      Stakeholder.register({
        id: 'stk-w2',
        kind: 'PERSON',
        fullName: 'Lucia Mendoza',
        dni: '44444442',
        actorId: 'user-1',
        now: NOW,
      }),
    );

    const byName = await repository.list({ search: 'mendoza', page: 1, pageSize: 10 });
    expect(byName.items.map((item) => item.id)).toEqual(['stk-w2']);

    const byDni = await repository.list({ search: '444442', page: 1, pageSize: 10 });
    expect(byDni.items.map((item) => item.id)).toEqual(['stk-w2']);

    const byRuc = await repository.list({ search: '204444', page: 1, pageSize: 10 });
    expect(byRuc.items.map((item) => item.id)).toEqual(['stk-w1']);

    const byPercent = await repository.list({ search: '%', page: 1, pageSize: 10 });
    expect(byPercent.items.map((item) => item.id)).toEqual(['stk-w1']);

    const byUnderscore = await repository.list({ search: '_', page: 1, pageSize: 10 });
    expect(byUnderscore.items.map((item) => item.id)).toEqual(['stk-w1']);
  }, 5_000);
});
