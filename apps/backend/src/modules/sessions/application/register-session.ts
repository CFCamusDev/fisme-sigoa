import { randomUUID } from 'node:crypto';
import type { SessionDto } from '@sigoa/shared';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { Session, type SessionStakeholderListInput } from '../domain/entities/session.js';
import {
  SessionExecutionNotFoundError,
  SessionStakeholderListNotFoundError,
} from '../domain/errors/index.js';
import type {
  SessionExecutionRepository,
  SessionPermissionChecker,
  SessionProcessExecutionReader,
  SessionRepository,
  SessionStakeholderListReader,
} from '../domain/ports/index.js';
import type { RegisterSessionCommand } from './register-session.types.js';
import { buildSessionDto } from './session-dto.js';

export interface RegisterSessionDependencies {
  readonly sessionRepository: SessionRepository;
  readonly sessionExecutionRepository: SessionExecutionRepository;
  readonly processExecutionReader: SessionProcessExecutionReader;
  readonly stakeholderListReader: SessionStakeholderListReader;
  readonly permissionChecker: SessionPermissionChecker;
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly idGenerator?: () => string;
  readonly clock?: () => Date;
}

/**
 * Registers a stakeholder session linked to one or more open process executions (HU-032, RF-032, RS-030).
 */
export class RegisterSessionUseCase {
  private readonly idGenerator: () => string;
  private readonly clock: () => Date;

  constructor(private readonly deps: RegisterSessionDependencies) {
    this.idGenerator = deps.idGenerator ?? randomUUID;
    this.clock = deps.clock ?? (() => new Date());
  }

  async execute(command: RegisterSessionCommand): Promise<SessionDto> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: command.actorId,
      permission: 'sesion.editar',
      scope: 'GLOBAL',
    });

    return await this.deps.unitOfWork.run(async () => {
      const uniqueExecutionIds = [...new Set(command.executionIds)];
      const foundExecutions = await this.deps.processExecutionReader.findByIds(uniqueExecutionIds);
      const executionById = new Map(foundExecutions.map((item) => [item.id, item]));
      const missingIds = uniqueExecutionIds.filter((id) => !executionById.has(id));

      if (missingIds.length > 0) {
        throw new SessionExecutionNotFoundError(missingIds);
      }

      const orderedExecutions = command.executionIds.map((id) => executionById.get(id)!);

      let stakeholderList: SessionStakeholderListInput | null = null;
      if (command.stakeholderListId) {
        const foundList = await this.deps.stakeholderListReader.findById(command.stakeholderListId);
        if (!foundList) {
          throw new SessionStakeholderListNotFoundError(command.stakeholderListId);
        }
        stakeholderList = foundList;
      }

      const now = this.clock();
      const session = Session.create({
        id: this.idGenerator(),
        stakeholderType: command.stakeholderType,
        stakeholderList,
        sessionDate: command.sessionDate,
        startTime: command.startTime,
        modality: command.modality,
        meetingUrl: command.meetingUrl,
        recordingUrl: command.recordingUrl,
        executions: orderedExecutions,
        actorId: command.actorId,
        now,
      });

      await this.deps.sessionRepository.save(session);
      await this.deps.sessionExecutionRepository.replaceLinks({
        sessionId: session.id,
        executionIds: session.executionIds,
        actorId: command.actorId,
        now,
      });

      await this.deps.auditLogger.log({
        action: 'CREATE',
        entity: 'Session',
        entityId: session.id,
        actor: command.actorId,
        ip: command.ip ?? undefined,
        before: null,
        after: session.snapshot(),
      });

      return buildSessionDto(session);
    });
  }
}
