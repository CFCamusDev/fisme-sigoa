import type { SemesterDto } from '@sigoa/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { PrismaAuditLogger } from '../../../../shared/prisma/prisma-audit-logger.js';
import { PrismaSemesterRepository } from './prisma-semester-repository.js';
import { CreateSemesterUseCase } from '../../application/create-semester.js';
import type { ParametersPermissionChecker } from '../../domain/ports/parameters-permission-checker.js';
import { SemesterCodeAlreadyExistsError, SemesterOverlapError } from '../../domain/errors/index.js';

describe('CreateSemesterUseCase Concurrency Integration (PostgreSQL real, T-010-04, CA1, CA2)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const auditLogger = new PrismaAuditLogger(uow);
  const semesterRepo = new PrismaSemesterRepository(uow);

  const permissionChecker: ParametersPermissionChecker = {
    assertAllowed: async () => {},
  };

  const useCase = new CreateSemesterUseCase({
    semesterRepository: semesterRepo,
    permissionChecker,
    unitOfWork: uow,
    auditLogger,
  });

  beforeEach(async () => {
    await prisma.auditLog.deleteMany({ where: { entity: 'Semester' } });
    await prisma.semester.deleteMany();
  });

  it('lets exactly one of 20 simultaneous creations with the same code win', async () => {
    const attempts = Array.from({ length: 20 }, (_, index) =>
      useCase.execute({
        code: '2027-I',
        startDate: '2027-03-01',
        endDate: '2027-07-31',
        actorId: `admin_${index + 1}`,
      }),
    );

    const results = await Promise.allSettled(attempts);

    const fulfilled = results.filter(
      (r): r is PromiseFulfilledResult<SemesterDto> => r.status === 'fulfilled',
    );
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(19);

    for (const rej of rejected) {
      expect(rej.reason).toBeInstanceOf(SemesterCodeAlreadyExistsError);
    }

    const countInDb = await prisma.semester.count({
      where: { code: '2027-I' },
    });
    expect(countInDb).toBe(1);

    const auditRows = await prisma.auditLog.findMany({
      where: { entity: 'Semester', action: 'CREATE' },
    });
    expect(auditRows).toHaveLength(1);
  }, 15_000);

  it('lets exactly one of N simultaneous overlapping creations win (CA2)', async () => {
    // 5 candidatos con distintos códigos pero cuyas fechas se superponen todas con el rango central
    const overlappingRequests = [
      { code: '2027-I', startDate: '2027-03-01', endDate: '2027-07-31' },
      { code: '2027-II', startDate: '2027-07-31', endDate: '2027-12-31' }, // comparte frontera
      {
        code: '2027-III-mock',
        codeAlias: '2028-I',
        startDate: '2027-04-01',
        endDate: '2027-06-30',
      }, // contenido
      { code: '2028-II', startDate: '2027-01-01', endDate: '2027-12-31' }, // envolvente
    ];

    const attempts = overlappingRequests.map((req, index) =>
      useCase.execute({
        code: req.codeAlias ?? req.code,
        startDate: req.startDate,
        endDate: req.endDate,
        actorId: `admin_${index + 1}`,
      }),
    );

    const results = await Promise.allSettled(attempts);

    const fulfilled = results.filter(
      (r): r is PromiseFulfilledResult<SemesterDto> => r.status === 'fulfilled',
    );
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(overlappingRequests.length - 1);

    for (const rej of rejected) {
      expect(rej.reason).toBeInstanceOf(SemesterOverlapError);
    }

    const countInDb = await prisma.semester.count();
    expect(countInDb).toBe(1);

    const auditRows = await prisma.auditLog.findMany({
      where: { entity: 'Semester', action: 'CREATE' },
    });
    expect(auditRows).toHaveLength(1);
  }, 15_000);

  it('creates non-overlapping semesters simultaneously without losing any', async () => {
    const nonOverlappingRequests = [
      { code: '2027-I', startDate: '2027-03-01', endDate: '2027-07-31' },
      { code: '2027-II', startDate: '2027-08-01', endDate: '2027-12-31' },
      { code: '2028-I', startDate: '2028-03-01', endDate: '2028-07-31' },
    ];

    const attempts = nonOverlappingRequests.map((req, index) =>
      useCase.execute({
        code: req.code,
        startDate: req.startDate,
        endDate: req.endDate,
        actorId: `admin_${index + 1}`,
      }),
    );

    const results = await Promise.allSettled(attempts);

    const fulfilled = results.filter(
      (r): r is PromiseFulfilledResult<SemesterDto> => r.status === 'fulfilled',
    );
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');

    expect(fulfilled).toHaveLength(3);
    expect(rejected).toHaveLength(0);

    const countInDb = await prisma.semester.count();
    expect(countInDb).toBe(3);

    const auditRows = await prisma.auditLog.findMany({
      where: { entity: 'Semester', action: 'CREATE' },
    });
    expect(auditRows).toHaveLength(3);
  }, 15_000);
});
