import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import type { Attendee } from '../domain/entities/attendee.js';
import { Session } from '../domain/entities/session.js';
import { SessionExecutionNotOpenError } from '../domain/errors/session-execution-not-open-error.js';
import { SessionNotFoundError } from '../domain/errors/session-not-found-error.js';
import type {
  AttendeeRepository,
  SessionListMemberReader,
  SessionPermissionChecker,
  SessionProcessExecutionReader,
  SessionRepository,
} from '../domain/ports/index.js';
import { RegisterAttendeesUseCase } from './register-attendees.js';

const NOW = new Date('2026-11-17T16:00:00.000Z');

function makeSession(overrides?: Partial<Parameters<typeof Session.rehydrate>[0]>) {
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
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });
}

function createHarness(session: Session | null = makeSession()) {
  const sessionRepository = mock<SessionRepository>();
  sessionRepository.findByIdForUpdate.mockResolvedValue(session);

  const attendeeRepository = mock<AttendeeRepository>();
  attendeeRepository.listBySession.mockResolvedValue([]);
  attendeeRepository.replaceForSession.mockImplementation(async (input) =>
    input.entries.map((entry, index) => ({
      id: `att-${index + 1}`,
      sessionId: input.sessionId,
      listMemberId: entry.listMemberId,
      position: entry.position,
      createdBy: input.actorId,
      createdAt: input.now,
    })),
  );

  const processExecutionReader = mock<SessionProcessExecutionReader>();
  processExecutionReader.findByIds.mockResolvedValue([
    { id: 'exec-1', name: 'Medición OE 2026', status: 'IN_PROGRESS' },
  ]);

  const sessionListMemberReader = mock<SessionListMemberReader>();
  sessionListMemberReader.findByIds.mockResolvedValue([
    { id: 'mem-1', listId: 'list-1', fullName: 'Ana Pérez' },
    { id: 'mem-2', listId: 'list-1', fullName: 'Luis Torres' },
  ]);
  sessionListMemberReader.listByList.mockResolvedValue([
    { id: 'mem-1', fullName: 'Ana Pérez', institution: 'Empresa A', position: 'Analista' },
    { id: 'mem-2', fullName: 'Luis Torres', institution: 'Empresa B', position: 'Jefe' },
  ]);

  const permissionChecker = mock<SessionPermissionChecker>();
  permissionChecker.assertAllowed.mockResolvedValue(undefined);

  const unitOfWork: UnitOfWork = {
    run: async <T>(work: () => Promise<T>): Promise<T> => await work(),
  };

  const auditLogger = mock<AuditLogger>();
  auditLogger.log.mockResolvedValue(undefined);

  const useCase = new RegisterAttendeesUseCase({
    sessionRepository,
    attendeeRepository,
    processExecutionReader,
    sessionListMemberReader,
    permissionChecker,
    unitOfWork,
    auditLogger,
    clock: () => NOW,
  });

  return {
    useCase,
    sessionRepository,
    attendeeRepository,
    processExecutionReader,
    sessionListMemberReader,
    permissionChecker,
    auditLogger,
  };
}

describe('RegisterAttendeesUseCase', () => {
  it('replaces the attendees of the session and audits it', async () => {
    const { useCase, attendeeRepository, auditLogger, permissionChecker } = createHarness();

    const response = await useCase.execute({
      actorId: 'user-2',
      ip: '127.0.0.1',
      sessionId: 'sess-1',
      attendees: [{ listMemberId: 'mem-1', position: 'Gerente de TI' }],
    });

    expect(permissionChecker.assertAllowed).toHaveBeenCalledWith({
      actorId: 'user-2',
      permission: 'sesion.editar',
      scope: 'GLOBAL',
    });
    expect(attendeeRepository.replaceForSession).toHaveBeenCalledWith({
      sessionId: 'sess-1',
      entries: [{ listMemberId: 'mem-1', position: 'Gerente de TI' }],
      actorId: 'user-2',
      now: NOW,
    });
    expect(auditLogger.log).toHaveBeenCalledTimes(1);
    expect(response).toEqual({
      sessionId: 'sess-1',
      stakeholderListId: 'list-1',
      attendeeCount: 1,
      items: [
        {
          listMemberId: 'mem-1',
          fullName: 'Ana Pérez',
          institution: 'Empresa A',
          memberPosition: 'Analista',
          attended: true,
          position: 'Gerente de TI',
        },
        {
          listMemberId: 'mem-2',
          fullName: 'Luis Torres',
          institution: 'Empresa B',
          memberPosition: 'Jefe',
          attended: false,
          position: null,
        },
      ],
    });
  });

  it('throws forbidden without sesion.editar', async () => {
    const { useCase, permissionChecker, sessionRepository } = createHarness();
    permissionChecker.assertAllowed.mockRejectedValueOnce(new ForbiddenError('Sin permiso'));

    await expect(
      useCase.execute({
        actorId: 'user-2',
        sessionId: 'sess-1',
        attendees: [],
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(sessionRepository.findByIdForUpdate).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown session', async () => {
    const { useCase } = createHarness(null);

    await expect(
      useCase.execute({
        actorId: 'user-2',
        sessionId: 'sess-unknown',
        attendees: [],
      }),
    ).rejects.toBeInstanceOf(SessionNotFoundError);
  });

  it('rejects when an execution is not open', async () => {
    const { useCase, processExecutionReader, attendeeRepository } = createHarness();
    processExecutionReader.findByIds.mockResolvedValueOnce([
      { id: 'exec-1', name: 'Medición OE 2026', status: 'CLOSED' },
    ]);

    await expect(
      useCase.execute({
        actorId: 'user-2',
        sessionId: 'sess-1',
        attendees: [],
      }),
    ).rejects.toBeInstanceOf(SessionExecutionNotOpenError);

    expect(attendeeRepository.replaceForSession).not.toHaveBeenCalled();
  });

  it('does not write or audit when the set is unchanged', async () => {
    const existing: Attendee[] = [
      {
        id: 'att-1',
        sessionId: 'sess-1',
        listMemberId: 'mem-1',
        position: 'Gerente de TI',
        createdBy: 'user-1',
        createdAt: NOW,
      },
    ];
    const { useCase, attendeeRepository, auditLogger } = createHarness();
    attendeeRepository.listBySession.mockResolvedValueOnce(existing);

    const response = await useCase.execute({
      actorId: 'user-2',
      sessionId: 'sess-1',
      attendees: [{ listMemberId: 'mem-1', position: '  Gerente de TI  ' }],
    });

    expect(attendeeRepository.replaceForSession).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
    expect(response.attendeeCount).toBe(1);
  });

  it('audits before and after', async () => {
    const existing: Attendee[] = [
      {
        id: 'att-1',
        sessionId: 'sess-1',
        listMemberId: 'mem-1',
        position: 'Analista',
        createdBy: 'user-1',
        createdAt: NOW,
      },
    ];
    const { useCase, attendeeRepository, auditLogger } = createHarness();
    attendeeRepository.listBySession.mockResolvedValueOnce(existing);

    await useCase.execute({
      actorId: 'user-2',
      ip: '10.0.0.5',
      sessionId: 'sess-1',
      attendees: [{ listMemberId: 'mem-2', position: 'Director' }],
    });

    expect(vi.mocked(auditLogger.log)).toHaveBeenCalledWith({
      action: 'UPDATE',
      entity: 'SessionAttendees',
      entityId: 'sess-1',
      actor: 'user-2',
      ip: '10.0.0.5',
      before: { attendees: [{ listMemberId: 'mem-1', position: 'Analista' }] },
      after: { attendees: [{ listMemberId: 'mem-2', position: 'Director' }] },
    });
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
      const session = makeSession({ executionIds: ['exec-1', 'exec-2'] });
      const { useCase, processExecutionReader, attendeeRepository, auditLogger } =
        createHarness(session);
      processExecutionReader.findByIds.mockResolvedValueOnce(executions);

      await expect(
        useCase.execute({
          actorId: 'user-2',
          sessionId: 'sess-1',
          attendees: [{ listMemberId: 'mem-1', position: 'Gerente' }],
        }),
      ).rejects.toBeInstanceOf(SessionExecutionNotOpenError);

      expect(attendeeRepository.replaceForSession).not.toHaveBeenCalled();
      expect(auditLogger.log).not.toHaveBeenCalled();
    },
  );
});
