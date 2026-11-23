import { describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import { SessionExecutionNotFoundError } from '../domain/errors/session-execution-not-found-error.js';
import type {
  SessionPermissionChecker,
  SessionProcessExecutionReader,
  SessionReader,
} from '../domain/ports/index.js';
import { ListSessionsByExecutionUseCase } from './list-sessions-by-execution.js';

const NOW = new Date('2026-11-17T15:00:00.000Z');

function createHarness() {
  const sessionReader: SessionReader = {
    findById: vi.fn().mockResolvedValue(null),
    listByExecution: vi.fn().mockResolvedValue({
      items: [
        {
          id: 'sess-1',
          stakeholderType: 'EMPLOYER',
          stakeholderListId: null,
          sessionDate: '2026-11-20',
          startTime: '10:00',
          modality: 'IN_PERSON',
          meetingUrl: null,
          recordingUrl: null,
          executionIds: ['exec-1', 'exec-2'],
          attendeeCount: 4,
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
      total: 3,
    }),
  };

  const processExecutionReader: SessionProcessExecutionReader = {
    findByIds: vi
      .fn()
      .mockResolvedValue([{ id: 'exec-1', name: 'Revisión OE 2026', status: 'PLANNED' }]),
  };

  const permissionChecker: SessionPermissionChecker = {
    assertAllowed: vi.fn().mockResolvedValue(undefined),
  };

  const useCase = new ListSessionsByExecutionUseCase({
    sessionReader,
    processExecutionReader,
    permissionChecker,
  });

  return { useCase, sessionReader, processExecutionReader, permissionChecker };
}

describe('ListSessionsByExecutionUseCase', () => {
  it('lists the sessions of an execution with pagination', async () => {
    const { useCase, sessionReader } = createHarness();

    const response = await useCase.execute({
      actorId: 'user-1',
      executionId: 'exec-1',
      page: 1,
      pageSize: 20,
    });

    expect(response.total).toBe(3);
    expect(response.page).toBe(1);
    expect(response.pageSize).toBe(20);
    expect(response.items).toHaveLength(1);
    expect(response.items[0]?.executionIds).toEqual(['exec-1', 'exec-2']);
    expect(response.items[0]?.attendeeCount).toBe(4);
    expect(sessionReader.listByExecution).toHaveBeenCalledWith('exec-1', {
      page: 1,
      pageSize: 20,
    });
  });

  it('returns an empty page', async () => {
    const { useCase, sessionReader } = createHarness();
    vi.mocked(sessionReader.listByExecution).mockResolvedValueOnce({
      items: [],
      total: 0,
    });

    const response = await useCase.execute({
      actorId: 'user-1',
      executionId: 'exec-1',
      page: 1,
      pageSize: 20,
    });

    expect(response.total).toBe(0);
    expect(response.items).toEqual([]);
  });

  it('fails when the execution does not exist', async () => {
    const { useCase, processExecutionReader, sessionReader } = createHarness();
    vi.mocked(processExecutionReader.findByIds).mockResolvedValueOnce([]);

    await expect(
      useCase.execute({
        actorId: 'user-1',
        executionId: 'exec-missing',
        page: 1,
        pageSize: 20,
      }),
    ).rejects.toBeInstanceOf(SessionExecutionNotFoundError);

    expect(sessionReader.listByExecution).not.toHaveBeenCalled();
  });

  it('denies a user without sesion.ver', async () => {
    const { useCase, permissionChecker, sessionReader } = createHarness();
    vi.mocked(permissionChecker.assertAllowed).mockRejectedValueOnce(
      new ForbiddenError('No tienes permiso'),
    );

    await expect(
      useCase.execute({
        actorId: 'user-no-perm',
        executionId: 'exec-1',
        page: 1,
        pageSize: 20,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(permissionChecker.assertAllowed).toHaveBeenCalledWith({
      actorId: 'user-no-perm',
      permission: 'sesion.ver',
      scope: 'GLOBAL',
    });
    expect(sessionReader.listByExecution).not.toHaveBeenCalled();
  });

  it('does not audit a read', () => {
    // ListSessionsByExecutionUseCase has no AuditLogger dependency by design.
    expect(ListSessionsByExecutionUseCase.length).toBe(1);
  });
});
