import type { SessionAttendeesResponse } from '@sigoa/shared';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { snapshotAttendees } from '../domain/entities/attendee.js';
import { SessionExecutionNotFoundError, SessionNotFoundError } from '../domain/errors/index.js';
import { assertAttendeesInSessionList } from '../domain/policies/attendee-selection.js';
import { assertExecutionsLinkable } from '../domain/policies/session-execution-rule.js';
import type {
  AttendeeRepository,
  SessionListMemberReader,
  SessionPermissionChecker,
  SessionProcessExecutionReader,
  SessionRepository,
} from '../domain/ports/index.js';
import { buildSessionAttendeesResponse } from './attendee-dto.js';
import type { RegisterAttendeesCommand } from './register-attendees.types.js';

export interface RegisterAttendeesDependencies {
  readonly sessionRepository: SessionRepository;
  readonly attendeeRepository: AttendeeRepository;
  readonly processExecutionReader: SessionProcessExecutionReader;
  readonly sessionListMemberReader: SessionListMemberReader;
  readonly permissionChecker: SessionPermissionChecker;
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly clock?: () => Date;
}

/**
 * Replaces the set of attendees registered for a session in an atomic, audited transaction (HU-033, RF-033).
 */
export class RegisterAttendeesUseCase {
  private readonly clock: () => Date;

  constructor(private readonly deps: RegisterAttendeesDependencies) {
    this.clock = deps.clock ?? (() => new Date());
  }

  async execute(command: RegisterAttendeesCommand): Promise<SessionAttendeesResponse> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: command.actorId,
      permission: 'sesion.editar',
      scope: 'GLOBAL',
    });

    return await this.deps.unitOfWork.run(async () => {
      const session = await this.deps.sessionRepository.findByIdForUpdate(command.sessionId);
      if (!session) {
        throw new SessionNotFoundError(command.sessionId);
      }

      const executions = await this.deps.processExecutionReader.findByIds(session.executionIds);
      if (executions.length !== session.executionIds.length) {
        const foundSet = new Set(executions.map((item) => item.id));
        const missing = session.executionIds.filter((id) => !foundSet.has(id));
        throw new SessionExecutionNotFoundError(missing);
      }
      assertExecutionsLinkable(executions);

      const memberRefs = await this.deps.sessionListMemberReader.findByIds(
        command.attendees.map((entry) => entry.listMemberId),
      );
      const normalized = assertAttendeesInSessionList({
        sessionListId: session.stakeholderListId,
        entries: command.attendees,
        listMembers: memberRefs,
      });

      const currentAttendees = await this.deps.attendeeRepository.listBySession(session.id);
      const beforeSnapshot = snapshotAttendees(currentAttendees);
      const targetSnapshot = snapshotAttendees(normalized);
      const roster = await this.deps.sessionListMemberReader.listByList(session.stakeholderListId!);

      if (JSON.stringify(beforeSnapshot) === JSON.stringify(targetSnapshot)) {
        return buildSessionAttendeesResponse({
          sessionId: session.id,
          stakeholderListId: session.stakeholderListId,
          roster,
          attendees: currentAttendees,
        });
      }

      const now = this.clock();
      const savedAttendees = await this.deps.attendeeRepository.replaceForSession({
        sessionId: session.id,
        entries: normalized,
        actorId: command.actorId,
        now,
      });

      const afterSnapshot = snapshotAttendees(savedAttendees);
      await this.deps.auditLogger.log({
        action: 'UPDATE',
        entity: 'SessionAttendees',
        entityId: session.id,
        actor: command.actorId,
        ip: command.ip ?? undefined,
        before: { attendees: beforeSnapshot },
        after: { attendees: afterSnapshot },
      });

      return buildSessionAttendeesResponse({
        sessionId: session.id,
        stakeholderListId: session.stakeholderListId,
        roster,
        attendees: savedAttendees,
      });
    });
  }
}
