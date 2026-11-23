import { describe, expect, it, vi } from 'vitest';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { Session } from '../domain/entities/session.js';
import { DuplicateSessionError } from '../domain/errors/duplicate-session-error.js';
import { InvalidSessionDataError } from '../domain/errors/invalid-session-data-error.js';
import { SessionExecutionNotFoundError } from '../domain/errors/session-execution-not-found-error.js';
import { SessionExecutionNotOpenError } from '../domain/errors/session-execution-not-open-error.js';
import { SessionHasAttendeesError } from '../domain/errors/session-has-attendees-error.js';
import { SessionNotFoundError } from '../domain/errors/session-not-found-error.js';
import { SessionStakeholderListMismatchError } from '../domain/errors/session-stakeholder-list-mismatch-error.js';
import type {
  AttendeeRepository,
  SessionExecutionRepository,
  SessionPermissionChecker,
  SessionProcessExecutionReader,
  SessionRepository,
  SessionStakeholderListReader,
} from '../domain/ports/index.js';
import { EditSessionUseCase } from './edit-session.js';

const CREATED_AT = new Date('2026-11-17T10:00:00.000Z');
const UPDATED_AT = new Date('2026-11-17T16:00:00.000Z');

function makeExistingSession(overrides?: Partial<Parameters<typeof Session.rehydrate>[0]>) {
  return Session.rehydrate({
    id: 'sess-1',
    stakeholderType: 'EMPLOYER',
    stakeholderListId: 'list-1',
    sessionDate: '2026-11-20',
    startTime: '10:00',
    modality: 'IN_PERSON',
    meetingUrl: null,
    recordingUrl: null,
    executionIds: ['exec-1'],
    createdBy: 'user-1',
    updatedBy: null,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides,
  });
}

function createHarness(existing: Session | null = makeExistingSession()) {
  const sessionRepository: SessionRepository = {
    save: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    findByIdForUpdate: vi.fn().mockResolvedValue(existing),
  };

  const sessionExecutionRepository: SessionExecutionRepository = {
    replaceLinks: vi.fn().mockResolvedValue(undefined),
    findExecutionIds: vi.fn().mockResolvedValue(existing ? [...existing.executionIds] : []),
  };

  const attendeeRepository: Pick<AttendeeRepository, 'countBySession'> = {
    countBySession: vi.fn().mockResolvedValue(0),
  };

  const processExecutionReader: SessionProcessExecutionReader = {
    findByIds: vi.fn().mockImplementation(async (ids: readonly string[]) =>
      ids.map((id) => ({
        id,
        name: `Ejecución ${id}`,
        status: 'PLANNED' as const,
      })),
    ),
  };

  const stakeholderListReader: SessionStakeholderListReader = {
    findById: vi.fn().mockResolvedValue({ id: 'list-1', type: 'EMPLOYER' }),
  };

  const permissionChecker: SessionPermissionChecker = {
    assertAllowed: vi.fn().mockResolvedValue(undefined),
  };

  const unitOfWorkRun = vi.fn();
  const unitOfWork: UnitOfWork = {
    run: async <T>(work: () => Promise<T>): Promise<T> => {
      unitOfWorkRun();
      return await work();
    },
  };

  const auditLogger: AuditLogger = {
    log: vi.fn().mockResolvedValue(undefined),
  };

  const useCase = new EditSessionUseCase({
    sessionRepository,
    sessionExecutionRepository,
    attendeeRepository,
    processExecutionReader,
    stakeholderListReader,
    permissionChecker,
    unitOfWork,
    auditLogger,
    clock: () => UPDATED_AT,
  });

  return {
    useCase,
    sessionRepository,
    sessionExecutionRepository,
    attendeeRepository,
    processExecutionReader,
    stakeholderListReader,
    permissionChecker,
    unitOfWorkRun,
    auditLogger,
  };
}

describe('EditSessionUseCase', () => {
  it('updates the time and audits UPDATE with before and after', async () => {
    const { useCase, sessionRepository, sessionExecutionRepository, auditLogger } = createHarness();

    const dto = await useCase.execute({
      actorId: 'user-2',
      ip: '127.0.0.1',
      sessionId: 'sess-1',
      startTime: '11:30',
    });

    expect(dto.startTime).toBe('11:30');
    expect(sessionRepository.update).toHaveBeenCalledTimes(1);
    expect(sessionExecutionRepository.replaceLinks).not.toHaveBeenCalled();
    expect(auditLogger.log).toHaveBeenCalledWith({
      action: 'UPDATE',
      entity: 'Session',
      entityId: 'sess-1',
      actor: 'user-2',
      ip: '127.0.0.1',
      before: expect.objectContaining({ startTime: '10:00' }),
      after: expect.objectContaining({ startTime: '11:30' }),
    });
  });

  it('replaces the executions and links the new set', async () => {
    const { useCase, sessionExecutionRepository } = createHarness();

    const dto = await useCase.execute({
      actorId: 'user-2',
      sessionId: 'sess-1',
      executionIds: ['exec-1', 'exec-2', 'exec-3'],
    });

    expect(dto.executionIds).toEqual(['exec-1', 'exec-2', 'exec-3']);
    expect(sessionExecutionRepository.replaceLinks).toHaveBeenCalledWith({
      sessionId: 'sess-1',
      executionIds: ['exec-1', 'exec-2', 'exec-3'],
      actorId: 'user-2',
      now: UPDATED_AT,
    });
  });

  it('rejects removing all executions', async () => {
    const { useCase, sessionRepository } = createHarness();

    await expect(
      useCase.execute({
        actorId: 'user-2',
        sessionId: 'sess-1',
        executionIds: [],
      }),
    ).rejects.toBeInstanceOf(InvalidSessionDataError);

    expect(sessionRepository.update).not.toHaveBeenCalled();
  });

  it('clears previous links when switching from virtual to in person', async () => {
    const { useCase, sessionRepository } = createHarness(
      makeExistingSession({
        modality: 'VIRTUAL',
        meetingUrl: 'https://meet.example.com/room',
        recordingUrl: 'https://drive.example.com/video',
      }),
    );

    const dto = await useCase.execute({
      actorId: 'user-2',
      sessionId: 'sess-1',
      modality: 'IN_PERSON',
    });

    expect(dto.modality).toBe('IN_PERSON');
    expect(dto.meetingUrl).toBeNull();
    expect(dto.recordingUrl).toBeNull();
    expect(sessionRepository.update).toHaveBeenCalledTimes(1);
  });

  it('requires the links when switching to virtual', async () => {
    const { useCase, sessionRepository } = createHarness();

    await expect(
      useCase.execute({
        actorId: 'user-2',
        sessionId: 'sess-1',
        modality: 'VIRTUAL',
      }),
    ).rejects.toBeInstanceOf(InvalidSessionDataError);

    expect(sessionRepository.update).not.toHaveBeenCalled();
  });

  it('clears previous links when switching from virtual to in person', async () => {
    const { useCase, sessionRepository } = createHarness(
      makeExistingSession({
        modality: 'VIRTUAL',
        meetingUrl: 'https://meet.example.com/room',
        recordingUrl: 'https://drive.example.com/video',
      }),
    );

    const dto = await useCase.execute({
      actorId: 'user-2',
      sessionId: 'sess-1',
      modality: 'IN_PERSON',
    });

    expect(dto.modality).toBe('IN_PERSON');
    expect(dto.meetingUrl).toBeNull();
    expect(dto.recordingUrl).toBeNull();
    expect(sessionRepository.update).toHaveBeenCalledTimes(1);
  });

  it('denies a user without sesion.editar', async () => {
    const { useCase, permissionChecker, unitOfWorkRun } = createHarness();
    vi.mocked(permissionChecker.assertAllowed).mockRejectedValueOnce(
      new ForbiddenError('No tienes permiso'),
    );

    await expect(
      useCase.execute({
        actorId: 'user-no-perm',
        sessionId: 'sess-1',
        startTime: '12:00',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(permissionChecker.assertAllowed).toHaveBeenCalledWith({
      actorId: 'user-no-perm',
      permission: 'sesion.editar',
      scope: 'GLOBAL',
    });
    expect(unitOfWorkRun).not.toHaveBeenCalled();
  });

  it('fails when the session does not exist', async () => {
    const { useCase } = createHarness(null);

    await expect(
      useCase.execute({
        actorId: 'user-2',
        sessionId: 'sess-missing',
        startTime: '12:00',
      }),
    ).rejects.toBeInstanceOf(SessionNotFoundError);
  });

  it('fails when a linked execution is not open', async () => {
    const { useCase, processExecutionReader } = createHarness();
    vi.mocked(processExecutionReader.findByIds).mockResolvedValueOnce([
      { id: 'exec-1', name: 'Ejecución Cerrada', status: 'CLOSED' },
    ]);

    await expect(
      useCase.execute({
        actorId: 'user-2',
        sessionId: 'sess-1',
        startTime: '12:00',
      }),
    ).rejects.toBeInstanceOf(SessionExecutionNotOpenError);
  });

  it('fails when a new execution does not exist or is not open', async () => {
    const { useCase, processExecutionReader } = createHarness();
    vi.mocked(processExecutionReader.findByIds)
      .mockResolvedValueOnce([{ id: 'exec-1', name: 'E1', status: 'PLANNED' }])
      .mockResolvedValueOnce([]);

    await expect(
      useCase.execute({
        actorId: 'user-2',
        sessionId: 'sess-1',
        executionIds: ['exec-missing'],
      }),
    ).rejects.toBeInstanceOf(SessionExecutionNotFoundError);

    vi.mocked(processExecutionReader.findByIds)
      .mockResolvedValueOnce([{ id: 'exec-1', name: 'E1', status: 'PLANNED' }])
      .mockResolvedValueOnce([{ id: 'exec-closed', name: 'Cerrada', status: 'CLOSED' }]);

    await expect(
      useCase.execute({
        actorId: 'user-2',
        sessionId: 'sess-1',
        executionIds: ['exec-closed'],
      }),
    ).rejects.toBeInstanceOf(SessionExecutionNotOpenError);
  });

  it('rejects changing the type while keeping a list of the other type', async () => {
    const { useCase } = createHarness();

    await expect(
      useCase.execute({
        actorId: 'user-2',
        sessionId: 'sess-1',
        stakeholderType: 'GRADUATE',
      }),
    ).rejects.toBeInstanceOf(SessionStakeholderListMismatchError);
  });

  it('clears the stakeholder list with null', async () => {
    const { useCase } = createHarness();

    const dto = await useCase.execute({
      actorId: 'user-2',
      sessionId: 'sess-1',
      stakeholderListId: null,
    });

    expect(dto.stakeholderListId).toBeNull();
  });

  it('returns the current session without writing or auditing when nothing changes', async () => {
    const { useCase, sessionRepository, sessionExecutionRepository, auditLogger } = createHarness();

    const dto = await useCase.execute({
      actorId: 'user-2',
      sessionId: 'sess-1',
      startTime: '10:00',
      executionIds: ['exec-1'],
    });

    expect(dto.id).toBe('sess-1');
    expect(sessionRepository.update).not.toHaveBeenCalled();
    expect(sessionExecutionRepository.replaceLinks).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('locks the session row before reading it', async () => {
    const { useCase, sessionRepository, processExecutionReader } = createHarness();

    await useCase.execute({
      actorId: 'user-2',
      sessionId: 'sess-1',
      startTime: '12:00',
    });

    const lockOrder = vi.mocked(sessionRepository.findByIdForUpdate).mock.invocationCallOrder[0];
    const readExecOrder = vi.mocked(processExecutionReader.findByIds).mock.invocationCallOrder[0];
    expect(lockOrder).toBeDefined();
    expect(readExecOrder).toBeDefined();
    expect(lockOrder!).toBeLessThan(readExecOrder!);
  });

  it('leaves no audit record when the update hits a duplicate', async () => {
    const { useCase, sessionRepository, sessionExecutionRepository, auditLogger } = createHarness();
    vi.mocked(sessionRepository.update).mockRejectedValueOnce(
      new DuplicateSessionError('EMPLOYER', '2026-11-20', '11:00'),
    );

    await expect(
      useCase.execute({
        actorId: 'user-2',
        sessionId: 'sess-1',
        startTime: '11:00',
        executionIds: ['exec-1', 'exec-2'],
      }),
    ).rejects.toBeInstanceOf(DuplicateSessionError);

    expect(sessionExecutionRepository.replaceLinks).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('rejects changing the list when attendees exist', async () => {
    const { useCase, attendeeRepository, sessionRepository, auditLogger } = createHarness();
    vi.mocked(attendeeRepository.countBySession).mockResolvedValue(2);

    await expect(
      useCase.execute({
        actorId: 'user-2',
        sessionId: 'sess-1',
        stakeholderListId: 'list-2',
      }),
    ).rejects.toBeInstanceOf(SessionHasAttendeesError);

    expect(sessionRepository.update).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('keeps editing other fields with attendees', async () => {
    const { useCase, attendeeRepository, sessionRepository } = createHarness();
    vi.mocked(attendeeRepository.countBySession).mockResolvedValue(2);

    const updated = await useCase.execute({
      actorId: 'user-2',
      sessionId: 'sess-1',
      startTime: '11:30',
    });

    expect(updated.startTime).toBe('11:30');
    expect(sessionRepository.update).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      name: 'closed',
      executions: [
        { id: 'exec-1', name: 'Ejecución 1', status: 'CLOSED' as const },
        { id: 'exec-2', name: 'Ejecución 2', status: 'CLOSED' as const },
      ],
    },
    {
      name: 'voided',
      executions: [
        { id: 'exec-1', name: 'Ejecución 1', status: 'VOIDED' as const },
        { id: 'exec-2', name: 'Ejecución 2', status: 'VOIDED' as const },
      ],
    },
    {
      name: 'mixed closed and voided',
      executions: [
        { id: 'exec-1', name: 'Ejecución 1', status: 'CLOSED' as const },
        { id: 'exec-2', name: 'Ejecución 2', status: 'VOIDED' as const },
      ],
    },
  ])(
    'rejects with SessionExecutionNotOpenError when every linked execution is $name',
    async ({ executions }) => {
      const existing = makeExistingSession({ executionIds: ['exec-1', 'exec-2'] });
      const { useCase, processExecutionReader, sessionRepository, auditLogger } =
        createHarness(existing);
      vi.mocked(processExecutionReader.findByIds).mockResolvedValueOnce(executions);

      await expect(
        useCase.execute({
          actorId: 'user-2',
          sessionId: 'sess-1',
          startTime: '12:00',
        }),
      ).rejects.toBeInstanceOf(SessionExecutionNotOpenError);

      expect(sessionRepository.update).not.toHaveBeenCalled();
      expect(auditLogger.log).not.toHaveBeenCalled();
    },
  );
});
