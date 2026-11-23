import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import { ProcessExecution } from '../domain/entities/process-execution.js';
import type { ProcessExecutionReader, ProcessPermissionChecker } from '../domain/ports/index.js';
import { ListProcessExecutionsUseCase } from './list-process-executions.js';

const NOW = new Date('2027-01-15T10:00:00.000Z');

describe('ListProcessExecutionsUseCase (HU-027, T-027-07, T-027-17)', () => {
  let reader: MockProxy<ProcessExecutionReader>;
  let permissionChecker: MockProxy<ProcessPermissionChecker>;
  let useCase: ListProcessExecutionsUseCase;

  beforeEach(() => {
    reader = mock<ProcessExecutionReader>();
    permissionChecker = mock<ProcessPermissionChecker>();
    useCase = new ListProcessExecutionsUseCase({
      processExecutionReader: reader,
      permissionChecker,
    });
  });

  it('denies a user without ejecucion.ver', async () => {
    permissionChecker.assertAllowed.mockRejectedValueOnce(new ForbiddenError());

    await expect(
      useCase.execute({
        actorId: 'user-2',
        page: 1,
        pageSize: 20,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(reader.list).not.toHaveBeenCalled();
  });

  it('lists with filters and pagination', async () => {
    const execution = ProcessExecution.create({
      id: 'exec-1',
      programId: 'prog-1',
      type: 'P622',
      year: 2027,
      semester: { id: 'sem-1', code: '2027-I' },
      catalogVersion: { id: 'cv-1', programId: 'prog-1', status: 'APPROVED' },
      actorId: 'user-1',
      now: NOW,
    });

    reader.list.mockResolvedValueOnce({
      items: [{ execution, semesterCode: '2027-I', catalogVersionNumber: 3 }],
      total: 25,
    });

    const result = await useCase.execute({
      actorId: 'user-1',
      type: 'P622',
      year: 2027,
      status: 'PLANNED',
      page: 2,
      pageSize: 10,
    });

    expect(permissionChecker.assertAllowed).toHaveBeenCalledWith({
      actorId: 'user-1',
      permission: 'ejecucion.ver',
      scope: 'GLOBAL',
    });
    expect(reader.list).toHaveBeenCalledWith({
      type: 'P622',
      year: 2027,
      status: 'PLANNED',
      page: 2,
      pageSize: 10,
    });
    expect(result).toEqual({
      items: [
        {
          id: 'exec-1',
          type: 'P622',
          name: 'Medición directa de AG 2027-I',
          year: 2027,
          semesterId: 'sem-1',
          semesterCode: '2027-I',
          catalogVersionId: 'cv-1',
          catalogVersionNumber: 3,
          status: 'PLANNED',
          voidReason: null,
          createdAt: NOW.toISOString(),
          updatedAt: NOW.toISOString(),
        },
      ],
      page: 2,
      pageSize: 10,
      total: 25,
      totalPages: 3,
    });
  });

  it('returns an empty page', async () => {
    reader.list.mockResolvedValueOnce({ items: [], total: 0 });

    const result = await useCase.execute({
      actorId: 'user-1',
      page: 1,
      pageSize: 20,
    });

    expect(result).toEqual({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
    });
  });

  it('does not audit a read', async () => {
    reader.list.mockResolvedValueOnce({ items: [], total: 0 });

    const result = await useCase.execute({
      actorId: 'user-1',
      page: 1,
      pageSize: 20,
    });

    expect(result.total).toBe(0);
    // ListProcessExecutionsDependencies no recibe AuditLogger por diseño (D8)
    expect(useCase).not.toHaveProperty('auditLogger');
  });
});
