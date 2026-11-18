import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type {
  SessionProcessExecutionRef,
  SessionProcessExecutionStatus,
} from '../../domain/policies/session-execution-rule.js';
import type { SessionProcessExecutionReader } from '../../domain/ports/session-process-execution-reader.js';

export class PrismaSessionProcessExecutionReader implements SessionProcessExecutionReader {
  constructor(private readonly dbProvider: DbProvider) {}

  async findByIds(ids: readonly string[]): Promise<readonly SessionProcessExecutionRef[]> {
    if (ids.length === 0) {
      return [];
    }

    const rows = await this.dbProvider.get().processExecution.findMany({
      where: { id: { in: [...ids] } },
      select: {
        id: true,
        name: true,
        status: true,
      },
    });

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status as SessionProcessExecutionStatus,
    }));
  }
}
