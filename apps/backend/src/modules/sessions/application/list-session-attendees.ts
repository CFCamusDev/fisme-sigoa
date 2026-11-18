import type { SessionAttendeesResponse } from '@sigoa/shared';
import { SessionNotFoundError } from '../domain/errors/index.js';
import type {
  AttendeeRepository,
  SessionListMemberReader,
  SessionPermissionChecker,
  SessionReader,
} from '../domain/ports/index.js';
import { buildSessionAttendeesResponse } from './attendee-dto.js';
import type { ListSessionAttendeesQuery } from './list-session-attendees.types.js';

export interface ListSessionAttendeesDependencies {
  readonly sessionReader: Pick<SessionReader, 'findById'>;
  readonly attendeeRepository: Pick<AttendeeRepository, 'listBySession'>;
  readonly sessionListMemberReader: Pick<SessionListMemberReader, 'listByList'>;
  readonly permissionChecker: SessionPermissionChecker;
}

/**
 * Lists the Anexo 3 roster of a session along with attendance marks and recorded positions (HU-033).
 */
export class ListSessionAttendeesUseCase {
  constructor(private readonly deps: ListSessionAttendeesDependencies) {}

  async execute(query: ListSessionAttendeesQuery): Promise<SessionAttendeesResponse> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: query.actorId,
      permission: 'sesion.ver',
      scope: 'GLOBAL',
    });

    const session = await this.deps.sessionReader.findById(query.sessionId);
    if (!session) {
      throw new SessionNotFoundError(query.sessionId);
    }

    if (!session.stakeholderListId) {
      return buildSessionAttendeesResponse({
        sessionId: session.id,
        stakeholderListId: null,
        roster: [],
        attendees: [],
      });
    }

    const [roster, attendees] = await Promise.all([
      this.deps.sessionListMemberReader.listByList(session.stakeholderListId),
      this.deps.attendeeRepository.listBySession(session.id),
    ]);

    return buildSessionAttendeesResponse({
      sessionId: session.id,
      stakeholderListId: session.stakeholderListId,
      roster,
      attendees,
    });
  }
}
