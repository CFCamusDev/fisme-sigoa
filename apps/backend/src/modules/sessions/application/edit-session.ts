import type { SessionDto } from '@sigoa/shared';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import type { SessionStakeholderListInput } from '../domain/entities/session.js';
import {
  SessionExecutionNotFoundError,
  SessionNotFoundError,
  SessionStakeholderListNotFoundError,
} from '../domain/errors/index.js';
import {
  assertExecutionsLinkable,
  type SessionProcessExecutionRef,
} from '../domain/policies/session-execution-rule.js';
import type {
  SessionExecutionRepository,
  SessionPermissionChecker,
  SessionProcessExecutionReader,
  SessionRepository,
  SessionStakeholderListReader,
} from '../domain/ports/index.js';
import type { EditSessionCommand } from './edit-session.types.js';
import { buildSessionDto } from './session-dto.js';

export interface EditSessionDependencies {
  readonly sessionRepository: SessionRepository;
  readonly sessionExecutionRepository: SessionExecutionRepository;
  readonly processExecutionReader: SessionProcessExecutionReader;
  readonly stakeholderListReader: SessionStakeholderListReader;
  readonly permissionChecker: SessionPermissionChecker;
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly clock?: () => Date;
}

function snapshotsEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function sameSortedIds(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((value, idx) => value === sortedB[idx]);
}

/**
 * Edits an existing stakeholder session while locking the row and auditing changes (HU-032, RF-032).
 */
export class EditSessionUseCase {
  private readonly clock: () => Date;

  constructor(private readonly deps: EditSessionDependencies) {
    this.clock = deps.clock ?? (() => new Date());
  }

  async execute(command: EditSessionCommand): Promise<SessionDto> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: command.actorId,
      permission: 'sesion.editar',
      scope: 'GLOBAL',
    });

    return await this.deps.unitOfWork.run(async () => {
      const current = await this.deps.sessionRepository.findByIdForUpdate(command.sessionId);
      if (!current) {
        throw new SessionNotFoundError(command.sessionId);
      }

      const currentExecutions = await this.deps.processExecutionReader.findByIds(
        current.executionIds,
      );
      if (currentExecutions.length !== current.executionIds.length) {
        const foundSet = new Set(currentExecutions.map((item) => item.id));
        const missing = current.executionIds.filter((id) => !foundSet.has(id));
        throw new SessionExecutionNotFoundError(missing);
      }
      assertExecutionsLinkable(currentExecutions);

      let nextExecutions: readonly SessionProcessExecutionRef[] | undefined;
      if (command.executionIds !== undefined) {
        const uniqueIds = [...new Set(command.executionIds)];
        const foundNext = await this.deps.processExecutionReader.findByIds(uniqueIds);
        const byId = new Map(foundNext.map((item) => [item.id, item]));
        const missingIds = uniqueIds.filter((id) => !byId.has(id));
        if (missingIds.length > 0) {
          throw new SessionExecutionNotFoundError(missingIds);
        }
        nextExecutions = command.executionIds.map((id) => byId.get(id)!);
      }

      let stakeholderListArg: SessionStakeholderListInput | null | undefined;
      if (command.stakeholderListId !== undefined) {
        if (command.stakeholderListId === null) {
          stakeholderListArg = null;
        } else {
          const foundList = await this.deps.stakeholderListReader.findById(
            command.stakeholderListId,
          );
          if (!foundList) {
            throw new SessionStakeholderListNotFoundError(command.stakeholderListId);
          }
          stakeholderListArg = foundList;
        }
      } else if (
        command.stakeholderType !== undefined &&
        command.stakeholderType !== current.stakeholderType &&
        current.stakeholderListId !== null
      ) {
        stakeholderListArg = await this.deps.stakeholderListReader.findById(
          current.stakeholderListId,
        );
      }

      const beforeSnapshot = current.snapshot();
      const now = this.clock();
      const updated = current.applyChanges({
        stakeholderType: command.stakeholderType,
        stakeholderList: stakeholderListArg,
        sessionDate: command.sessionDate,
        startTime: command.startTime,
        modality: command.modality,
        meetingUrl: command.meetingUrl,
        recordingUrl: command.recordingUrl,
        executions: nextExecutions,
        actorId: command.actorId,
        now,
      });

      const afterSnapshot = updated.snapshot();
      if (snapshotsEqual(beforeSnapshot, afterSnapshot)) {
        return buildSessionDto(current);
      }

      await this.deps.sessionRepository.update(updated);
      if (!sameSortedIds(current.executionIds, updated.executionIds)) {
        await this.deps.sessionExecutionRepository.replaceLinks({
          sessionId: updated.id,
          executionIds: updated.executionIds,
          actorId: command.actorId,
          now,
        });
      }

      await this.deps.auditLogger.log({
        action: 'UPDATE',
        entity: 'Session',
        entityId: updated.id,
        actor: command.actorId,
        ip: command.ip ?? undefined,
        before: beforeSnapshot,
        after: afterSnapshot,
      });

      return buildSessionDto(updated);
    });
  }
}
