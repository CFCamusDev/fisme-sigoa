import { describe, expect, it, beforeEach } from 'vitest';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { PrismaProgramRepository } from './prisma-program-repository.js';
import { Program } from '../../domain/entities/program.js';
import { ProgramCodeAlreadyExistsError } from '../../domain/errors/index.js';

describe('PrismaProgramRepository Integration (PostgreSQL real, parameters module)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const programRepo = new PrismaProgramRepository(uow);

  beforeEach(async () => {
    await prisma.program.deleteMany();
  });

  it('getCurrent returns null when table is empty and reads the program when present', async () => {
    const empty = await programRepo.getCurrent();
    expect(empty).toBeNull();

    const program = Program.create({
      id: 'prog-integ-1',
      code: 'EPIS',
      name: 'Ingeniería de Sistemas',
      faculty: 'Facultad de Ingeniería',
      createdBy: 'admin-1',
      updatedBy: 'admin-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await programRepo.add(program);

    const current = await programRepo.getCurrent();
    expect(current).not.toBeNull();
    expect(current?.id).toBe('prog-integ-1');
    expect(current?.code).toBe('EPIS');
    expect(current?.name).toBe('Ingeniería de Sistemas');
    expect(current?.faculty).toBe('Facultad de Ingeniería');
  }, 15_000);

  it('findCurrentForUpdate throws when called outside an active transaction', async () => {
    await expect(programRepo.findCurrentForUpdate()).rejects.toThrow(
      'findCurrentForUpdate solo puede ejecutarse dentro de una transacción activa (UnitOfWork).',
    );
  }, 15_000);

  it('findCurrentForUpdate locks the program row and serializes concurrent transactions', async () => {
    const program = Program.create({
      id: 'prog-integ-lock-1',
      code: 'EPIS',
      name: 'Ingeniería de Sistemas',
      faculty: 'Facultad de Ingeniería',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await programRepo.add(program);

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
      const p1 = await programRepo.findCurrentForUpdate();
      expect(p1).not.toBeNull();
      tx1ReadNotify();

      await tx2AttemptPromise;
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 50);
      });

      p1!.applyChanges({ name: 'Nombre Tx1' }, 'admin-1');
      await programRepo.save(p1!);
      executionOrder.push('tx1');
    });

    const tx2 = (async () => {
      await tx1ReadPromise;
      tx2AttemptNotify();

      await uow.run(async () => {
        const p2 = await programRepo.findCurrentForUpdate();
        expect(p2).not.toBeNull();
        expect(p2?.name).toBe('Nombre Tx1');
        p2!.applyChanges({ name: 'Nombre Tx2' }, 'admin-2');
        await programRepo.save(p2!);
        executionOrder.push('tx2');
      });
    })();

    await Promise.all([tx1, tx2]);

    expect(executionOrder).toEqual(['tx1', 'tx2']);
    const finalInDb = await programRepo.getCurrent();
    expect(finalInDb?.name).toBe('Nombre Tx2');
  }, 15_000);

  it('save updates the program in the database and updates updatedAt', async () => {
    const program = Program.create({
      id: 'prog-integ-save-1',
      code: 'EPIS',
      name: 'Nombre Original',
      faculty: 'Facultad Original',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    await programRepo.add(program);

    program.applyChanges(
      {
        name: 'Nombre Modificado',
        faculty: 'Facultad Modificada',
      },
      'admin-updater',
    );
    await programRepo.save(program);

    const saved = await programRepo.getCurrent();
    expect(saved?.name).toBe('Nombre Modificado');
    expect(saved?.faculty).toBe('Facultad Modificada');
    expect(saved?.updatedBy).toBe('admin-updater');
  }, 15_000);

  it('duplicate code throws ProgramCodeAlreadyExistsError on unique constraint violation', async () => {
    const program1 = Program.create({
      id: 'prog-dup-1',
      code: 'EPIS',
      name: 'Programa 1',
      faculty: 'Facultad 1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await programRepo.add(program1);

    const program2 = Program.create({
      id: 'prog-dup-2',
      code: 'EPIS',
      name: 'Programa 2',
      faculty: 'Facultad 2',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(programRepo.add(program2)).rejects.toThrow(ProgramCodeAlreadyExistsError);
  }, 15_000);
});
