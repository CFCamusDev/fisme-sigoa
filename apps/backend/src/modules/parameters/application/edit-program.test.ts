import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditProgramUseCase } from './edit-program.js';
import { Program } from '../domain/entities/program.js';
import type { ProgramRepository } from '../domain/ports/program-repository.js';
import type { ParametersPermissionChecker } from '../domain/ports/parameters-permission-checker.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import { ProgramNotFoundError } from '../domain/errors/program-not-found-error.js';
import { ProgramCodeAlreadyExistsError } from '../domain/errors/program-code-already-exists-error.js';

describe('EditProgramUseCase (unit tests)', () => {
  let mockRepo: ProgramRepository;
  let mockUow: UnitOfWork;
  let mockAudit: AuditLogger;
  let mockAuthorizer: ParametersPermissionChecker;
  let useCase: EditProgramUseCase;

  const createSampleProgram = (
    overrides?: Partial<{ id: string; code: string; name: string; faculty: string }>,
  ) =>
    Program.create({
      id: overrides?.id ?? 'prog-1',
      code: overrides?.code ?? 'EPIS',
      name: overrides?.name ?? 'Ingeniería de Sistemas',
      faculty: overrides?.faculty ?? 'Facultad de Ingeniería',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

  beforeEach(() => {
    mockRepo = {
      findCurrentForUpdate: vi.fn(),
      save: vi.fn(),
    };

    mockUow = {
      run: vi.fn().mockImplementation((work) => work()),
    };

    mockAudit = {
      log: vi.fn().mockResolvedValue(undefined),
    };

    mockAuthorizer = {
      assertAllowed: vi.fn().mockResolvedValue(undefined),
    };

    useCase = new EditProgramUseCase({
      programRepository: mockRepo,
      permissionChecker: mockAuthorizer,
      unitOfWork: mockUow,
      auditLogger: mockAudit,
    });
  });

  it('updates the program, audits the change with before/after snapshots and returns DTO', async () => {
    const existingProgram = createSampleProgram();
    vi.mocked(mockRepo.findCurrentForUpdate).mockResolvedValue(existingProgram);
    vi.mocked(mockRepo.save).mockResolvedValue(undefined);

    const result = await useCase.execute({
      actorId: 'admin-1',
      ip: '192.168.1.10',
      code: 'EPIS-NEW',
      name: 'Ingeniería de Sistemas e Informática',
      faculty: 'Facultad de Ingeniería y Ciencias',
    });

    expect(mockAuthorizer.assertAllowed).toHaveBeenCalledWith({
      actorId: 'admin-1',
      permission: 'parametro.editar',
      scope: 'GLOBAL',
    });
    expect(mockUow.run).toHaveBeenCalledTimes(1);
    expect(mockRepo.findCurrentForUpdate).toHaveBeenCalledTimes(1);
    expect(mockRepo.save).toHaveBeenCalledTimes(1);
    expect(mockAudit.log).toHaveBeenCalledWith({
      action: 'PARAMETER_CHANGE',
      entity: 'Program',
      entityId: 'prog-1',
      actor: 'admin-1',
      ip: '192.168.1.10',
      before: {
        code: 'EPIS',
        name: 'Ingeniería de Sistemas',
        faculty: 'Facultad de Ingeniería',
      },
      after: {
        code: 'EPIS-NEW',
        name: 'Ingeniería de Sistemas e Informática',
        faculty: 'Facultad de Ingeniería y Ciencias',
      },
    });
    expect(result).toEqual({
      id: 'prog-1',
      code: 'EPIS-NEW',
      name: 'Ingeniería de Sistemas e Informática',
      faculty: 'Facultad de Ingeniería y Ciencias',
      updatedAt: expect.any(String),
    });
  });

  it('is idempotent when data is identical: returns current DTO without saving or auditing', async () => {
    const existingProgram = createSampleProgram();
    vi.mocked(mockRepo.findCurrentForUpdate).mockResolvedValue(existingProgram);

    const result = await useCase.execute({
      actorId: 'admin-1',
      code: 'EPIS',
      name: 'Ingeniería de Sistemas',
      faculty: 'Facultad de Ingeniería',
    });

    expect(mockAuthorizer.assertAllowed).toHaveBeenCalledWith({
      actorId: 'admin-1',
      permission: 'parametro.editar',
      scope: 'GLOBAL',
    });
    expect(mockUow.run).toHaveBeenCalledTimes(1);
    expect(mockRepo.findCurrentForUpdate).toHaveBeenCalledTimes(1);
    expect(mockRepo.save).not.toHaveBeenCalled();
    expect(mockAudit.log).not.toHaveBeenCalled();
    expect(result).toEqual({
      id: 'prog-1',
      code: 'EPIS',
      name: 'Ingeniería de Sistemas',
      faculty: 'Facultad de Ingeniería',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('rejects execution when actor lacks permission without opening transaction or touching repository', async () => {
    vi.mocked(mockAuthorizer.assertAllowed).mockRejectedValue(new ForbiddenError());

    await expect(
      useCase.execute({
        actorId: 'unauthorized-user',
        name: 'Nuevo Nombre',
      }),
    ).rejects.toThrow(ForbiddenError);

    expect(mockAuthorizer.assertAllowed).toHaveBeenCalledWith({
      actorId: 'unauthorized-user',
      permission: 'parametro.editar',
      scope: 'GLOBAL',
    });
    expect(mockUow.run).not.toHaveBeenCalled();
    expect(mockRepo.findCurrentForUpdate).not.toHaveBeenCalled();
    expect(mockRepo.save).not.toHaveBeenCalled();
    expect(mockAudit.log).not.toHaveBeenCalled();
  });

  it('throws ProgramNotFoundError when no program exists in the database', async () => {
    vi.mocked(mockRepo.findCurrentForUpdate).mockResolvedValue(null);

    await expect(
      useCase.execute({
        actorId: 'admin-1',
        name: 'Nuevo Nombre',
      }),
    ).rejects.toThrow(ProgramNotFoundError);

    expect(mockRepo.save).not.toHaveBeenCalled();
    expect(mockAudit.log).not.toHaveBeenCalled();
  });

  it('propagates ProgramCodeAlreadyExistsError when the repository rejects a duplicate code', async () => {
    const existingProgram = createSampleProgram();
    vi.mocked(mockRepo.findCurrentForUpdate).mockResolvedValue(existingProgram);
    vi.mocked(mockRepo.save).mockRejectedValue(
      new ProgramCodeAlreadyExistsError(
        "El código de programa 'EPIS-DUP' ya se encuentra registrado.",
      ),
    );

    await expect(
      useCase.execute({
        actorId: 'admin-1',
        code: 'EPIS-DUP',
      }),
    ).rejects.toThrow(ProgramCodeAlreadyExistsError);

    expect(mockRepo.save).toHaveBeenCalledTimes(1);
    expect(mockAudit.log).not.toHaveBeenCalled();
  });
});
