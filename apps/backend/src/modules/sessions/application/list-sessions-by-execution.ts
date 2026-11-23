import { listSessionsResponseSchema, type ListSessionsResponse } from '@sigoa/shared';
import { SessionExecutionNotFoundError } from '../domain/errors/session-execution-not-found-error.js';
import type {
  SessionPermissionChecker,
  SessionProcessExecutionReader,
  SessionReader,
} from '../domain/ports/index.js';
import type { ListSessionsByExecutionQueryInput } from './list-sessions-by-execution.types.js';

export interface ListSessionsByExecutionDependencies {
  readonly sessionReader: SessionReader;
  readonly processExecutionReader: SessionProcessExecutionReader;
  readonly permissionChecker: SessionPermissionChecker;
}

/**
 * Lists sessions linked to a given process execution with pagination (HU-032, RF-032).
 */
export class ListSessionsByExecutionUseCase {
  constructor(private readonly deps: ListSessionsByExecutionDependencies) {}

  async execute(query: ListSessionsByExecutionQueryInput): Promise<ListSessionsResponse> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: query.actorId,
      permission: 'sesion.ver',
      scope: 'GLOBAL',
    });

    const executions = await this.deps.processExecutionReader.findByIds([query.executionId]);
    if (executions.length === 0) {
      throw new SessionExecutionNotFoundError([query.executionId]);
    }

    const result = await this.deps.sessionReader.listByExecution(query.executionId, {
      page: query.page,
      pageSize: query.pageSize,
    });

    return listSessionsResponseSchema.parse({
      items: result.items.map((item) => ({
        id: item.id,
        stakeholderType: item.stakeholderType,
        stakeholderListId: item.stakeholderListId,
        sessionDate: item.sessionDate,
        startTime: item.startTime,
        modality: item.modality,
        meetingUrl: item.meetingUrl,
        recordingUrl: item.recordingUrl,
        executionIds: [...item.executionIds],
        attendeeCount: item.attendeeCount,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
      total: result.total,
      page: query.page,
      pageSize: query.pageSize,
    });
  }
}
