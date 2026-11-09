import { describe, it, expect, vi } from 'vitest';
import { EditProgramUseCase } from './edit-program.js';
import { Program } from '../domain/entities/program.js';
import type { ProgramRepository } from '../domain/ports/program-repository.js';
import type { ParametersPermissionChecker } from '../domain/ports/parameters-permission-checker.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import { ForbiddenError } from '../../../shared/errors/app-error.js';

describe('EditProgramUseCase (unit minimum)', () => {
  it('updates the program, audits the change and returns DTO', async () => {
    const existingProgram = Program.create({
      id: 'prog-1',
      code: 'EPIS',
      name: 'Ingeniería de Sistemas',
      faculty: 'Facultad de Ingeniería',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const mockRepo: ProgramRepository = {
      findCurrentForUpdate: vi.fn().mockResolvedValue(existingProgram),
      save: vi.fn().mockResolvedValue(undefined),
    };

    const mockUow: UnitOfWork = {
      run: vi.fn().mockImplementation((work) => work({})),
    };

    const mockAudit: AuditLogger = {
      log: vi.fn().mockResolvedValue(undefined),
    };

    const mockAuthorizer: ParametersPermissionChecker = {
      assertAllowed: vi.fn().mockResolvedValue(undefined),
    };

    const useCase = new EditProgramUseCase({
      programRepository: mockRepo,
      permissionChecker: mockAuthorizer,
      unitOfWork: mockUow,
      auditLogger: mockAudit,
    });

    const result = await useCase.execute({
      actorId: 'admin-1',
      name: 'Ingeniería de Sistemas e Informática',
    });

    expect(mockAuthorizer.assertAllowed).toHaveBeenCalledWith({
      actorId: 'admin-1',
      permission: 'parametro.editar',
      scope: 'GLOBAL',
    });
    expect(mockRepo.save).toHaveBeenCalled();
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PARAMETER_CHANGE',
        entity: 'Program',
        entityId: 'prog-1',
        before: {
          code: 'EPIS',
          name: 'Ingeniería de Sistemas',
          faculty: 'Facultad de Ingeniería',
        },
        after: {
          code: 'EPIS',
          name: 'Ingeniería de Sistemas e Informática',
          faculty: 'Facultad de Ingeniería',
        },
      }),
    );
    expect(result.name).toBe('Ingeniería de Sistemas e Informática');
    expect(result.code).toBe('EPIS');
  });

  it('rejects execution when actor lacks permission without opening transaction', async () => {
    const mockRepo: ProgramRepository = {
      findCurrentForUpdate: vi.fn(),
      save: vi.fn(),
    };
    const mockUow: UnitOfWork = {
      run: vi.fn(),
    };
    const mockAudit: AuditLogger = {
      log: vi.fn(),
    };
    const mockAuthorizer: ParametersPermissionChecker = {
      assertAllowed: vi.fn().mockRejectedValue(new ForbiddenError()),
    };

    const useCase = new EditProgramUseCase({
      programRepository: mockRepo,
      permissionChecker: mockAuthorizer,
      unitOfWork: mockUow,
      auditLogger: mockAudit,
    });

    await expect(
      useCase.execute({
        actorId: 'unauthorized-user',
        name: 'Nuevo Nombre',
      }),
    ).rejects.toThrow(ForbiddenError);

    expect(mockUow.run).not.toHaveBeenCalled();
    expect(mockRepo.save).not.toHaveBeenCalled();
  });
});
