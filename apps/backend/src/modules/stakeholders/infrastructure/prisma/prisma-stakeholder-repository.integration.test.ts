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

    const attempts = Array.from({ length: 5 }, (_, index) =>
      uow.run(async () => {
        const current = await repository.findById('stk-cv1');
        if (!current || current.status !== 'ACTIVE') {
          return false;
        }
        const voided = current.void({
          reason: `Anulacion concurrente intento ${index + 1}`,
          actorId: `user-${index + 1}`,
          now: LATER,
        });
        return repository.saveChanges(voided, 'ACTIVE');
      }),
    );

    const results = await Promise.all(attempts);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(results.filter((updated) => !updated)).toHaveLength(4);

    const finalState = await repository.findById('stk-cv1');
    expect(finalState?.status).toBe('VOIDED');
  }, 5_000);
});
