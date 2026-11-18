import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type { SessionModality } from '../../domain/entities/session-modality.js';
import type { SessionStakeholderType } from '../../domain/entities/session-stakeholder-type.js';
import type {
  ReplaceSessionLinksInput,
  SessionExecutionRepository,
} from '../../domain/ports/session-execution-repository.js';
import type {
  ListSessionsByExecutionParams,
  ListSessionsByExecutionResult,
  SessionListRef,
  SessionReader,
} from '../../domain/ports/session-reader.js';
import { formatUtcDateToIso } from './prisma-session-mapper.js';

export class PrismaSessionExecutionRepository implements SessionExecutionRepository, SessionReader {
  constructor(private readonly dbProvider: DbProvider) {}

  async findById(sessionId: string): Promise<SessionListRef | null> {
    return this.dbProvider.get().session.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        stakeholderListId: true,
      },
    });
  }

  async replaceLinks(input: ReplaceSessionLinksInput): Promise<void> {
    const db = this.dbProvider.get();
    const targetIds = [...new Set(input.executionIds)];

    await db.sessionExecution.deleteMany({
      where: {
        sessionId: input.sessionId,
        processExecutionId: { notIn: targetIds },
      },
    });

    if (targetIds.length === 0) {
      return;
    }

    const existing = await db.sessionExecution.findMany({
      where: {
        sessionId: input.sessionId,
        processExecutionId: { in: targetIds },
      },
      select: { processExecutionId: true },
    });

    const existingSet = new Set(existing.map((row) => row.processExecutionId));
    const missingIds = targetIds.filter((id) => !existingSet.has(id));

    if (missingIds.length === 0) {
      return;
    }

    await db.sessionExecution.createMany({
      data: missingIds.map((processExecutionId) => ({
        sessionId: input.sessionId,
        processExecutionId,
        createdBy: input.actorId,
        createdAt: input.now,
      })),
    });
  }

  async findExecutionIds(sessionId: string): Promise<readonly string[]> {
    const rows = await this.dbProvider.get().sessionExecution.findMany({
      where: { sessionId },
      select: { processExecutionId: true },
      orderBy: { processExecutionId: 'asc' },
    });
    return rows.map((row) => row.processExecutionId);
  }

  async listByExecution(
    executionId: string,
    params: ListSessionsByExecutionParams,
  ): Promise<ListSessionsByExecutionResult> {
    const db = this.dbProvider.get();
    const where = {
      executions: {
        some: { processExecutionId: executionId },
      },
    };

    const total = await db.session.count({ where });
    const rows = await db.session.findMany({
      where,
      orderBy: [{ sessionDate: 'desc' }, { startTime: 'desc' }, { id: 'asc' }],
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      include: {
        executions: {
          select: { processExecutionId: true },
          orderBy: { processExecutionId: 'asc' },
        },
      },
    });

    return {
      items: rows.map((row) => ({
        id: row.id,
        stakeholderType: row.stakeholderType as SessionStakeholderType,
        stakeholderListId: row.stakeholderListId,
        sessionDate: formatUtcDateToIso(row.sessionDate),
        startTime: row.startTime,
        modality: row.modality as SessionModality,
        meetingUrl: row.meetingUrl,
        recordingUrl: row.recordingUrl,
        executionIds: row.executions.map((link) => link.processExecutionId),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
      total,
    };
  }
}
