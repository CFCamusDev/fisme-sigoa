import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type { ProcessExecution } from '../../domain/entities/process-execution.js';
import {
  PRECONDITION_LABELS,
  type ExecutionPreconditionResult,
} from '../../domain/entities/process-execution-precondition.js';
import type { ExecutionPreconditionProvider } from '../../domain/ports/execution-precondition-provider.js';

export class PrismaSchedulePreconditionProvider implements ExecutionPreconditionProvider {
  readonly codes = ['SCHEDULE_HAS_ACTIVITY'] as const;

  constructor(private readonly dbProvider: DbProvider) {}

  async evaluate(execution: ProcessExecution): Promise<readonly ExecutionPreconditionResult[]> {
    const count = await this.dbProvider.get().scheduleActivity.count({
      where: { processExecutionId: execution.id },
    });

    return [
      {
        code: 'SCHEDULE_HAS_ACTIVITY',
        label: PRECONDITION_LABELS.SCHEDULE_HAS_ACTIVITY,
        state: count >= 1 ? 'MET' : 'UNMET',
      },
    ];
  }
}
