import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type { ProcessExecutionStatus } from '../../domain/entities/process-execution-status.js';
import type { ProcessType } from '../../domain/entities/process-type.js';
import type {
  LockedScheduleExecution,
  ScheduleExecutionLocker,
} from '../../domain/ports/schedule-execution-locker.js';

interface LockedExecutionRow {
  id: string;
  status: ProcessExecutionStatus;
  type: ProcessType;
}

export class PrismaScheduleExecutionLocker implements ScheduleExecutionLocker {
  constructor(private readonly dbProvider: DbProvider) {}

  async lockById(executionId: string): Promise<LockedScheduleExecution | null> {
    const rows = await this.dbProvider.get().$queryRaw<LockedExecutionRow[]>`
      SELECT "id", "status", "type"
      FROM "process_executions"
      WHERE "id" = ${executionId}
      FOR UPDATE
    `;

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      status: row.status,
      type: row.type,
    };
  }
}
