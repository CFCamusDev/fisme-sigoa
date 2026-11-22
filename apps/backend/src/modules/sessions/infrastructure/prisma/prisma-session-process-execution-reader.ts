import { Prisma } from '../../../../shared/prisma/generated/client.js';
import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type {
  SessionProcessExecutionRef,
  SessionProcessExecutionStatus,
} from '../../domain/policies/session-execution-rule.js';
import type { SessionProcessExecutionReader } from '../../domain/ports/session-process-execution-reader.js';

interface SessionExecutionLockRow {
  readonly id: string;
  readonly name: string;
  readonly status: string;
}

export class PrismaSessionProcessExecutionReader implements SessionProcessExecutionReader {
  constructor(private readonly dbProvider: DbProvider) {}

  async findByIds(ids: readonly string[]): Promise<readonly SessionProcessExecutionRef[]> {
    if (ids.length === 0) {
      return [];
    }

    const sortedIds = [...new Set(ids)].sort();
    const rows = await this.dbProvider.get().$queryRaw<SessionExecutionLockRow[]>`
      SELECT "id", "name", "status"
      FROM "process_executions"
      WHERE "id" IN (${Prisma.join(sortedIds)})
      ORDER BY "id" ASC
      FOR SHARE
    `;

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status as SessionProcessExecutionStatus,
    }));
  }
}
