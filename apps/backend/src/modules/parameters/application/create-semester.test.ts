import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateSemesterUseCase } from './create-semester.js';
import type { SemesterRepository } from '../domain/ports/semester-repository.js';
import type { ParametersPermissionChecker } from '../domain/ports/parameters-permission-checker.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import { Semester } from '../domain/entities/semester.js';
import {
  InvalidSemesterDataError,
  SemesterCodeAlreadyExistsError,
  SemesterOverlapError,
} from '../domain/errors/index.js';
import { ForbiddenError } from '../../../shared/errors/app-error.js';

describe('CreateSemesterUseCase Unit Tests (T-010-13, CA1, CA2, CA3, RS-002, RS-020)', () => {
  let semesterRepo: SemesterRepository;
  let permissionChecker: ParametersPermissionChecker;
  let unitOfWork: UnitOfWork;
  let auditLogger: AuditLogger;
  let useCase: CreateSemesterUseCase;

  const validCommand = {
    code: '2027-I',
    startDate: '2027-03-01',
    endDate: '2027-07-31',
    actorId: 'admin_1',
    ip: '127.0.0.1',
  };

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
    const result = await useCase.execute(validCommand);

    expect(permissionChecker.assertAllowed).toHaveBeenCalledWith({
      actorId: 'admin_1',
      permission: 'parametro.editar',
      scope: 'GLOBAL',
    });

    expect(unitOfWork.run).toHaveBeenCalledTimes(1);
    expect(semesterRepo.lockAndListAll).toHaveBeenCalledTimes(1);
    expect(semesterRepo.add).toHaveBeenCalledTimes(1);

    expect(auditLogger.log).toHaveBeenCalledWith({
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
    });

    expect(result).toEqual({
      id: 'sem_mock_id',
      code: '2027-I',
      startDate: '2027-03-01',
      endDate: '2027-07-31',
      updatedAt: '2026-11-09T12:00:00.000Z',
    });
  });

  it('rejects when permission is denied and never starts a transaction or calls repository (RS-002, RS-020)', async () => {
    vi.mocked(permissionChecker.assertAllowed).mockRejectedValueOnce(
      new ForbiddenError('No tienes permiso para editar parámetros.'),
    );

    await expect(useCase.execute(validCommand)).rejects.toThrow(ForbiddenError);

    expect(unitOfWork.run).not.toHaveBeenCalled();
    expect(semesterRepo.lockAndListAll).not.toHaveBeenCalled();
    expect(semesterRepo.add).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('rejects an overlapping semester without persisting or auditing (CA2)', async () => {
    const existing = Semester.create({
      id: 'sem_existing',
      code: '2027-I',
      startDate: '2027-03-01',
      endDate: '2027-07-31',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(semesterRepo.lockAndListAll).mockResolvedValueOnce([existing]);

    await expect(
      useCase.execute({
        ...validCommand,
        code: '2027-II',
        startDate: '2027-07-31', // comparte frontera con existing
        endDate: '2027-12-31',
      }),
    ).rejects.toThrow(SemesterOverlapError);

    expect(semesterRepo.add).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('rejects duplicate code without persisting or auditing', async () => {
    const existing = Semester.create({
      id: 'sem_existing',
      code: '2027-I',
      startDate: '2026-03-01',
      endDate: '2026-07-31',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(semesterRepo.lockAndListAll).mockResolvedValueOnce([existing]);

    await expect(
      useCase.execute({
        ...validCommand,
        code: '2027-I', // código duplicado
        startDate: '2027-03-01',
        endDate: '2027-07-31',
      }),
    ).rejects.toThrow(SemesterCodeAlreadyExistsError);

    expect(semesterRepo.add).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('rejects invalid code format without persisting or auditing (CA3)', async () => {
    await expect(
      useCase.execute({
        ...validCommand,
        code: '2027-III',
      }),
    ).rejects.toThrow(InvalidSemesterDataError);

    expect(semesterRepo.add).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('rejects invalid chronology without persisting or auditing', async () => {
    await expect(
      useCase.execute({
        ...validCommand,
        startDate: '2027-07-31',
        endDate: '2027-03-01',
      }),
    ).rejects.toThrow(InvalidSemesterDataError);

    expect(semesterRepo.add).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('uses default idGenerator and clock when not explicitly provided', async () => {
    const defaultUseCase = new CreateSemesterUseCase({
      semesterRepository: semesterRepo,
      permissionChecker,
      unitOfWork,
      auditLogger,
    });

    const result = await defaultUseCase.execute(validCommand);
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('string');
    expect(result.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
