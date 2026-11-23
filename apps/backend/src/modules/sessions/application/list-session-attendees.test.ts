import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import { SessionNotFoundError } from '../domain/errors/session-not-found-error.js';
import type {
  AttendeeRepository,
  SessionListMemberReader,
  SessionPermissionChecker,
  SessionReader,
} from '../domain/ports/index.js';
import { ListSessionAttendeesUseCase } from './list-session-attendees.js';

const NOW = new Date('2026-11-17T16:00:00.000Z');

function createHarness() {
  const sessionReader = mock<SessionReader>();
  sessionReader.findById.mockResolvedValue({
    id: 'sess-1',
    stakeholderListId: 'list-1',
  });

  const attendeeRepository = mock<AttendeeRepository>();
  attendeeRepository.listBySession.mockResolvedValue([
    {
      id: 'att-1',
      sessionId: 'sess-1',
      listMemberId: 'mem-1',
      position: 'Gerente de TI',
      createdBy: 'user-1',
      createdAt: NOW,
    },
  ]);

  const sessionListMemberReader = mock<SessionListMemberReader>();
  sessionListMemberReader.listByList.mockResolvedValue([
    {
      id: 'mem-1',
      fullName: 'Ana Pérez',
      institution: 'Empresa A',
      ruc: '20123456789',
      representative: 'Carlos Mendoza',
      position: 'Analista',
    },
    {
      id: 'mem-2',
      fullName: 'Luis Torres',
      institution: null,
      ruc: null,
      representative: null,
      position: null,
    },
  ]);

  const permissionChecker = mock<SessionPermissionChecker>();
  permissionChecker.assertAllowed.mockResolvedValue(undefined);

  const useCase = new ListSessionAttendeesUseCase({
    sessionReader,
    attendeeRepository,
    sessionListMemberReader,
    permissionChecker,
  });

  return { useCase, sessionReader, attendeeRepository, sessionListMemberReader, permissionChecker };
}

describe('ListSessionAttendeesUseCase', () => {
  it('returns the roster with attendance marks and recorded positions', async () => {
    const { useCase, permissionChecker } = createHarness();

    const result = await useCase.execute({
      actorId: 'user-1',
      sessionId: 'sess-1',
    });

    expect(permissionChecker.assertAllowed).toHaveBeenCalledWith({
      actorId: 'user-1',
      permission: 'sesion.ver',
      scope: 'GLOBAL',
    });
    expect(result).toEqual({
      sessionId: 'sess-1',
      stakeholderListId: 'list-1',
      attendeeCount: 1,
      items: [
        {
          listMemberId: 'mem-1',
          fullName: 'Ana Pérez',
          institution: 'Empresa A',
          ruc: '20123456789',
          representative: 'Carlos Mendoza',
          memberPosition: 'Analista',
          attended: true,
          position: 'Gerente de TI',
        },
        {
          listMemberId: 'mem-2',
          fullName: 'Luis Torres',
          institution: null,
          ruc: null,
          representative: null,
          memberPosition: null,
          attended: false,
          position: null,
        },
      ],
    });
  });

  it('throws forbidden without sesion.ver', async () => {
    const { useCase, permissionChecker, sessionReader } = createHarness();
    permissionChecker.assertAllowed.mockRejectedValueOnce(new ForbiddenError('Sin permiso'));

    await expect(
      useCase.execute({ actorId: 'user-1', sessionId: 'sess-1' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(sessionReader.findById).not.toHaveBeenCalled();
  });

  it('returns 404 when the session does not exist', async () => {
    const { useCase, sessionReader } = createHarness();
    sessionReader.findById.mockResolvedValueOnce(null);

    await expect(
      useCase.execute({ actorId: 'user-1', sessionId: 'sess-missing' }),
    ).rejects.toBeInstanceOf(SessionNotFoundError);
  });

  it('returns an empty roster when the session has no list', async () => {
    const { useCase, sessionReader, sessionListMemberReader } = createHarness();
    sessionReader.findById.mockResolvedValueOnce({ id: 'sess-1', stakeholderListId: null });

    const result = await useCase.execute({ actorId: 'user-1', sessionId: 'sess-1' });

    expect(result).toEqual({
      sessionId: 'sess-1',
      stakeholderListId: null,
      attendeeCount: 0,
      items: [],
    });
    expect(sessionListMemberReader.listByList).not.toHaveBeenCalled();
  });
});
