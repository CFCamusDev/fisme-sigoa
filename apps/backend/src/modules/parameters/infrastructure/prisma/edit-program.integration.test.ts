import { beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { PrismaProgramRepository } from './prisma-program-repository.js';
import { EditProgramUseCase } from '../../application/edit-program.js';
import { Program } from '../../domain/entities/program.js';

describe('EditProgramUseCase Concurrency & Integration (PostgreSQL real, parameters module)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const auditServices = createPrismaAuditServices(uow);
  const programRepo = new PrismaProgramRepository(uow);

  beforeEach(async () => {
    await prisma.program.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.auditChainHead.deleteMany();
  });

  function createUseCase() {
    return new EditProgramUseCase({
      programRepository: programRepo,
      permissionChecker: {
        assertAllowed: async () => {},
      },
      unitOfWork: uow,
      auditLogger: auditServices.auditLogger,
    });
  }

  it('applies 20 simultaneous identical edits once and keeps a valid audit chain', async () => {
    const initialProgram = Program.create({
      id: 'prog-concurrent-1',
      code: 'EPIS',
      name: 'Ingeniería de Sistemas',
      faculty: 'Facultad de Ingeniería',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await programRepo.add(initialProgram);

    const useCase = createUseCase();
    const calls = Array.from({ length: 20 }, (_, i) =>
      useCase.execute({
        actorId: `admin-${i}`,
        name: 'Ingeniería de Sistemas e Informática',
      }),
    );

    const results = await Promise.allSettled(calls);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');

    expect(fulfilled).toHaveLength(20);

    const programInDb = await programRepo.getCurrent();
    expect(programInDb?.name).toBe('Ingeniería de Sistemas e Informática');

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entity: 'Program',
        action: 'PARAMETER_CHANGE',
        entityId: 'prog-concurrent-1',
      },
    });
    // Exactamente 1 auditoría porque las otras 19 al ver que ya se cambió el nombre no auditan
    expect(auditLogs).toHaveLength(1);

    const chainResult = await auditServices.chainVerifier.verify();
    expect(chainResult.valid).toBe(true);
    expect(chainResult.checked).toBe(1);
  }, 15_000);

  it('serializes two different simultaneous edits without losing the audit trail', async () => {
    const initialProgram = Program.create({
      id: 'prog-concurrent-diff-1',
      code: 'EPIS',
      name: 'Ingeniería de Sistemas',
      faculty: 'Facultad de Ingeniería',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await programRepo.add(initialProgram);

    const useCase = createUseCase();
    const [resA, resB] = await Promise.allSettled([
      useCase.execute({
        actorId: 'admin-a',
        name: 'Nombre Desde A',
      }),
      useCase.execute({
        actorId: 'admin-b',
        name: 'Nombre Desde B',
      }),
    ]);

    expect(resA.status).toBe('fulfilled');
    expect(resB.status).toBe('fulfilled');

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entity: 'Program',
        action: 'PARAMETER_CHANGE',
        entityId: 'prog-concurrent-diff-1',
      },
      orderBy: { sequence: 'asc' },
    });
    expect(auditLogs).toHaveLength(2);

    const programInDb = await programRepo.getCurrent();
    expect(['Nombre Desde A', 'Nombre Desde B']).toContain(programInDb?.name);

    const chainResult = await auditServices.chainVerifier.verify();
    expect(chainResult.valid).toBe(true);
    expect(chainResult.checked).toBe(2);
  }, 15_000);
});
