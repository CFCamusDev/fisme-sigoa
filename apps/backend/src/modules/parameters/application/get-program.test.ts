import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetProgramUseCase } from './get-program.js';
import { Program } from '../domain/entities/program.js';
import type { ProgramReader } from '../domain/ports/program-reader.js';
import type { ParametersPermissionChecker } from '../domain/ports/parameters-permission-checker.js';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import { ProgramNotFoundError } from '../domain/errors/program-not-found-error.js';

describe('GetProgramUseCase (unit tests)', () => {
  let mockReader: ProgramReader;
  let mockAuthorizer: ParametersPermissionChecker;
  let useCase: GetProgramUseCase;

  beforeEach(() => {
    mockReader = {
      getCurrent: vi.fn(),
    };
    mockAuthorizer = {
      assertAllowed: vi.fn().mockResolvedValue(undefined),
    };
    useCase = new GetProgramUseCase({
      programReader: mockReader,
      permissionChecker: mockAuthorizer,
    });
  });

  it('returns program DTO when program exists and actor has permission', async () => {
    const existingProgram = Program.create({
      id: 'prog-1',
      code: 'EPIS',
      name: 'Ingeniería de Sistemas',
      faculty: 'Facultad de Ingeniería',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T12:00:00.000Z'),
    });
    vi.mocked(mockReader.getCurrent).mockResolvedValue(existingProgram);

    const result = await useCase.execute({ actorId: 'user-1' });

    expect(mockAuthorizer.assertAllowed).toHaveBeenCalledWith({
      actorId: 'user-1',
      permission: 'parametro.ver',
      scope: 'GLOBAL',
    });
    expect(mockReader.getCurrent).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      id: 'prog-1',
      code: 'EPIS',
      name: 'Ingeniería de Sistemas',
      faculty: 'Facultad de Ingeniería',
      updatedAt: '2026-01-02T12:00:00.000Z',
    });
  });

  it('throws ForbiddenError when actor lacks parametro.ver permission', async () => {
    vi.mocked(mockAuthorizer.assertAllowed).mockRejectedValue(new ForbiddenError());

    await expect(useCase.execute({ actorId: 'unauthorized-user' })).rejects.toThrow(ForbiddenError);

    expect(mockAuthorizer.assertAllowed).toHaveBeenCalledWith({
      actorId: 'unauthorized-user',
      permission: 'parametro.ver',
      scope: 'GLOBAL',
    });
    expect(mockReader.getCurrent).not.toHaveBeenCalled();
  });

  it('throws ProgramNotFoundError when program table is empty', async () => {
    vi.mocked(mockReader.getCurrent).mockResolvedValue(null);

    await expect(useCase.execute({ actorId: 'user-1' })).rejects.toThrow(ProgramNotFoundError);
  });
});
