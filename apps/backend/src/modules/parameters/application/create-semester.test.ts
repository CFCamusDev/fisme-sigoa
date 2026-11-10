import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CreateSemesterUseCase } from './create-semester.js';
import type { SemesterRepository } from '../domain/ports/semester-repository.js';
import type { ParametersPermissionChecker } from '../domain/ports/parameters-permission-checker.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';

describe('CreateSemesterUseCase Unit Tests (T-010-04, CA1)', () => {
  let semesterRepo: SemesterRepository;
  let permissionChecker: ParametersPermissionChecker;
  let unitOfWork: UnitOfWork;
  let auditLogger: AuditLogger;
  let useCase: CreateSemesterUseCase;

  beforeEach(() => {
    semesterRepo = {
      lockAndListAll: vi.fn().mockResolvedValue([]),
      add: vi.fn().mockResolvedValue(undefined),
    };

    permissionChecker = {
      assertAllowed: vi.fn().mockResolvedValue(undefined),
    };

    unitOfWork = {
      run: vi.fn().mockImplementation((work) => work()),
    };

    auditLogger = {
      log: vi.fn().mockResolvedValue(undefined),
    };

    useCase = new CreateSemesterUseCase({
      semesterRepository: semesterRepo,
      permissionChecker,
      unitOfWork,
      auditLogger,
      idGenerator: () => 'sem_mock_id',
      clock: () => new Date('2026-11-09T12:00:00.000Z'),
    });
  });

  it('creates a semester and audits it (CA1)', async () => {
    const result = await useCase.execute({
      code: '2027-I',
      startDate: '2027-03-01',
      endDate: '2027-07-31',
      actorId: 'admin_1',
      ip: '127.0.0.1',
    });

    expect(permissionChecker.assertAllowed).toHaveBeenCalledWith({
      actorId: 'admin_1',
      permission: 'parametro.editar',
      scope: 'GLOBAL',
    });

    expect(semesterRepo.lockAndListAll).toHaveBeenCalledTimes(1);
    expect(semesterRepo.add).toHaveBeenCalledTimes(1);

    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE',
        entity: 'Semester',
        entityId: 'sem_mock_id',
        actor: 'admin_1',
        ip: '127.0.0.1',
        after: {
          code: '2027-I',
          startDate: '2027-03-01',
          endDate: '2027-07-31',
        },
      }),
    );

    expect(result).toEqual({
      id: 'sem_mock_id',
      code: '2027-I',
      startDate: '2027-03-01',
      endDate: '2027-07-31',
      updatedAt: '2026-11-09T12:00:00.000Z',
    });
  });
});
