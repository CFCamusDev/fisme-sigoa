import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type { SessionModality } from '../../domain/entities/session-modality.js';
import type { SessionStakeholderType } from '../../domain/entities/session-stakeholder-type.js';
import { formatUtcDateToIso } from './prisma-session-mapper.js';

const BOARD_SESSIONS_LIMIT = 5;

export interface ExecutionBoardSessionItemRecord {
  readonly id: string;
  readonly stakeholderType: SessionStakeholderType;
  readonly sessionDate: string;
  readonly startTime: string;
  readonly modality: SessionModality;
}

export interface ExecutionBoardSessionsSummaryRecord {
  readonly total: number;
  readonly lastSessionDate: string | null;
  readonly items: readonly ExecutionBoardSessionItemRecord[];
}

export class PrismaExecutionBoardSessionsReader {
  constructor(private readonly dbProvider: DbProvider) {}

  async summarize(executionId: string): Promise<ExecutionBoardSessionsSummaryRecord> {
    const db = this.dbProvider.get();
    const [total, rows] = await Promise.all([
      db.sessionExecution.count({
        where: { processExecutionId: executionId },
      }),
      db.sessionExecution.findMany({
        where: { processExecutionId: executionId },
        orderBy: [
          { session: { sessionDate: 'desc' } },
          { session: { startTime: 'desc' } },
          { sessionId: 'desc' },
        ],
        take: BOARD_SESSIONS_LIMIT,
        include: {
          session: {
            select: {
              id: true,
              stakeholderType: true,
              sessionDate: true,
              startTime: true,
              modality: true,
            },
          },
        },
      }),
    ]);

    const items: ExecutionBoardSessionItemRecord[] = rows.map((row) => ({
      id: row.session.id,
      stakeholderType: row.session.stakeholderType as SessionStakeholderType,
      sessionDate: formatUtcDateToIso(row.session.sessionDate),
      startTime: row.session.startTime,
      modality: row.session.modality as SessionModality,
    }));

    return {
      total,
      lastSessionDate: items[0]?.sessionDate ?? null,
      items,
    };
  }
}
