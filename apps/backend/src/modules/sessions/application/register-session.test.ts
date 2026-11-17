import { sessionDtoSchema } from '@sigoa/shared';
import { describe, expect, it, vi } from 'vitest';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { DuplicateSessionError } from '../domain/errors/duplicate-session-error.js';
import { InvalidSessionDataError } from '../domain/errors/invalid-session-data-error.js';
import { SessionExecutionNotFoundError } from '../domain/errors/session-execution-not-found-error.js';
import { SessionExecutionNotOpenError } from '../domain/errors/session-execution-not-open-error.js';
import { SessionStakeholderListMismatchError } from '../domain/errors/session-stakeholder-list-mismatch-error.js';
import { SessionStakeholderListNotFoundError } from '../domain/errors/session-stakeholder-list-not-found-error.js';
import type {
  SessionExecutionRepository,
  SessionPermissionChecker,
  SessionProcessExecutionReader,
  SessionRepository,
  SessionStakeholderListReader,
} from '../domain/ports/index.js';
import { RegisterSessionUseCase } from './register-session.js';

const NOW = new Date('2026-11-17T15:00:00.000Z');

function createHarness() {
  const sessionRepository: SessionRepository = {
    save: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    findByIdForUpdate: vi.fn().mockResolvedValue(null),
  };

  const sessionExecutionRepository: SessionExecutionRepository = {
    replaceLinks: vi.fn().mockResolvedValue(undefined),
    findExecutionIds: vi.fn().mockResolvedValue([]),
  };

  const processExecutionReader: SessionProcessExecutionReader = {
    findByIds: vi.fn().mockResolvedValue([
      { id: 'exec-1', name: 'Revisión OE 2026', status: 'PLANNED' },
      { id: 'exec-2', name: 'Medición OE 2026', status: 'IN_PROGRESS' },
      { id: 'exec-3', name: 'Medición indirecta AG 2026', status: 'PLANNED' },
    ]),
  };

  const stakeholderListReader: SessionStakeholderListReader = {
    findById: vi.fn().mockResolvedValue({ id: 'list-1', type: 'EMPLOYER' }),
  };

  const permissionChecker: SessionPermissionChecker = {
    assertAllowed: vi.fn().mockResolvedValue(undefined),
  };

  const unitOfWork: UnitOfWork = {
    run: vi.fn(async <T>(work: () => Promise<T>) => await work()),
  };

  const auditLogger: AuditLogger = {
    log: vi.fn().mockResolvedValue(undefined),
  };

  const useCase = new RegisterSessionUseCase({
    sessionRepository,
    sessionExecutionRepository,
    processExecutionReader,
    stakeholderListReader,
    permissionChecker,
    unitOfWork,
    auditLogger,
    idGenerator: () => 'sess-1',
    clock: () => NOW,
  });

  return {
    useCase,
    sessionRepository,
    sessionExecutionRepository,
    processExecutionReader,
    stakeholderListReader,
    permissionChecker,
    unitOfWork,
    auditLogger,
  };
}

describe('RegisterSessionUseCase', () => {
  it('links one session to three executions', async () => {
    const { useCase, sessionRepository, sessionExecutionRepository } = createHarness();

    const dto = await useCase.execute({
      actorId: 'user-1',
      stakeholderType: 'EMPLOYER',
      stakeholderListId: 'list-1',
      sessionDate: '2026-11-20',
      startTime: '10:00',
      modality: 'IN_PERSON',
      executionIds: ['exec-1', 'exec-2', 'exec-3'],
    });

    expect(dto.executionIds).toEqual(['exec-1', 'exec-2', 'exec-3']);
    expect(sessionRepository.save).toHaveBeenCalledTimes(1);
    expect(sessionExecutionRepository.replaceLinks).toHaveBeenCalledWith({
      sessionId: 'sess-1',
      executionIds: ['exec-1', 'exec-2', 'exec-3'],
      actorId: 'user-1',
      now: NOW,
    });
  });

  it('rejects a session without executions', async () => {
    const { useCase, processExecutionReader, sessionRepository } = createHarness();
    vi.mocked(processExecutionReader.findByIds).mockResolvedValueOnce([]);

    await expect(
      useCase.execute({
        actorId: 'user-1',
        stakeholderType: 'EMPLOYER',
        sessionDate: '2026-11-20',
        startTime: '10:00',
        modality: 'IN_PERSON',
        executionIds: [],
      }),
    ).rejects.toBeInstanceOf(InvalidSessionDataError);

    expect(sessionRepository.save).not.toHaveBeenCalled();
  });

  it('requires the links when virtual', async () => {
    const { useCase, sessionRepository } = createHarness();

    await expect(
      useCase.execute({
        actorId: 'user-1',
        stakeholderType: 'EMPLOYER',
        sessionDate: '2026-11-20',
        startTime: '10:00',
        modality: 'VIRTUAL',
        meetingUrl: 'https://meet.example.com/room',
        recordingUrl: null,
        executionIds: ['exec-1'],
      }),
    ).rejects.toBeInstanceOf(InvalidSessionDataError);

    expect(sessionRepository.save).not.toHaveBeenCalled();
  });

  it('denies a user without sesion.editar', async () => {
    const { useCase, permissionChecker, unitOfWork } = createHarness();
    vi.mocked(permissionChecker.assertAllowed).mockRejectedValueOnce(
      new ForbiddenError('No tienes permiso'),
    );

    await expect(
      useCase.execute({
        actorId: 'user-no-perm',
        stakeholderType: 'EMPLOYER',
        sessionDate: '2026-11-20',
        startTime: '10:00',
        modality: 'IN_PERSON',
        executionIds: ['exec-1'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(permissionChecker.assertAllowed).toHaveBeenCalledWith({
      actorId: 'user-no-perm',
      permission: 'sesion.editar',
      scope: 'GLOBAL',
    });
    expect(unitOfWork.run).not.toHaveBeenCalled();
  });

  it('fails when an execution does not exist', async () => {
    const { useCase, processExecutionReader } = createHarness();
    vi.mocked(processExecutionReader.findByIds).mockResolvedValueOnce([
      { id: 'exec-1', name: 'Revisión OE 2026', status: 'PLANNED' },
    ]);

    await expect(
      useCase.execute({
        actorId: 'user-1',
        stakeholderType: 'EMPLOYER',
        sessionDate: '2026-11-20',
        startTime: '10:00',
        modality: 'IN_PERSON',
        executionIds: ['exec-1', 'exec-missing'],
      }),
    ).rejects.toBeInstanceOf(SessionExecutionNotFoundError);
  });

  it('fails when an execution is not open', async () => {
    const { useCase, processExecutionReader } = createHarness();
    vi.mocked(processExecutionReader.findByIds).mockResolvedValueOnce([
      { id: 'exec-1', name: 'Revisión OE 2026', status: 'CLOSED' },
    ]);

    await expect(
      useCase.execute({
        actorId: 'user-1',
        stakeholderType: 'EMPLOYER',
        sessionDate: '2026-11-20',
        startTime: '10:00',
        modality: 'IN_PERSON',
        executionIds: ['exec-1'],
      }),
    ).rejects.toBeInstanceOf(SessionExecutionNotOpenError);
  });

  it('fails when the stakeholder list does not exist or has another type', async () => {
    const { useCase, stakeholderListReader } = createHarness();

    vi.mocked(stakeholderListReader.findById).mockResolvedValueOnce(null);
    await expect(
      useCase.execute({
        actorId: 'user-1',
        stakeholderType: 'EMPLOYER',
        stakeholderListId: 'list-missing',
        sessionDate: '2026-11-20',
        startTime: '10:00',
        modality: 'IN_PERSON',
        executionIds: ['exec-1'],
      }),
    ).rejects.toBeInstanceOf(SessionStakeholderListNotFoundError);

    vi.mocked(stakeholderListReader.findById).mockResolvedValueOnce({
      id: 'list-grad',
      type: 'GRADUATE',
    });
    await expect(
      useCase.execute({
        actorId: 'user-1',
        stakeholderType: 'EMPLOYER',
        stakeholderListId: 'list-grad',
        sessionDate: '2026-11-20',
        startTime: '10:00',
        modality: 'IN_PERSON',
        executionIds: ['exec-1'],
      }),
    ).rejects.toBeInstanceOf(SessionStakeholderListMismatchError);
  });

  it('audits CREATE with the snapshot', async () => {
    const { useCase, auditLogger } = createHarness();

    await useCase.execute({
      actorId: 'user-1',
      ip: '127.0.0.1',
      stakeholderType: 'EMPLOYER',
      sessionDate: '2026-11-20',
      startTime: '10:00',
      modality: 'VIRTUAL',
      meetingUrl: 'https://meet.example.com/room',
      recordingUrl: 'https://drive.example.com/rec',
      executionIds: ['exec-2', 'exec-1'],
    });

    expect(auditLogger.log).toHaveBeenCalledWith({
      action: 'CREATE',
      entity: 'Session',
      entityId: 'sess-1',
      actor: 'user-1',
      ip: '127.0.0.1',
      before: null,
      after: {
        id: 'sess-1',
        stakeholderType: 'EMPLOYER',
        stakeholderListId: null,
        sessionDate: '2026-11-20',
        startTime: '10:00',
        modality: 'VIRTUAL',
        meetingUrl: 'https://meet.example.com/room',
        recordingUrl: 'https://drive.example.com/rec',
        executionIds: ['exec-1', 'exec-2'],
      },
    });
  });

  it('leaves no audit record when the save hits a duplicate', async () => {
    const { useCase, sessionRepository, sessionExecutionRepository, auditLogger } = createHarness();
    vi.mocked(sessionRepository.save).mockRejectedValueOnce(
      new DuplicateSessionError('EMPLOYER', '2026-11-20', '10:00'),
    );

    await expect(
      useCase.execute({
        actorId: 'user-1',
        stakeholderType: 'EMPLOYER',
        sessionDate: '2026-11-20',
        startTime: '10:00',
        modality: 'IN_PERSON',
        executionIds: ['exec-1'],
      }),
    ).rejects.toBeInstanceOf(DuplicateSessionError);

    expect(sessionExecutionRepository.replaceLinks).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('returns a DTO parsed with the shared schema', async () => {
    const { useCase } = createHarness();

    const dto = await useCase.execute({
      actorId: 'user-1',
      stakeholderType: 'EMPLOYER',
      sessionDate: '2026-11-20',
      startTime: '10:00',
      modality: 'IN_PERSON',
      executionIds: ['exec-1'],
    });

    expect(sessionDtoSchema.parse(dto)).toEqual(dto);
  });
});
