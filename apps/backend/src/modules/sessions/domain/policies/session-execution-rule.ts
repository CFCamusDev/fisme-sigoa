import { InvalidSessionDataError } from '../errors/invalid-session-data-error.js';
import { SessionExecutionNotOpenError } from '../errors/session-execution-not-open-error.js';

export const LINKABLE_EXECUTION_STATUSES = ['PLANNED', 'IN_PROGRESS'] as const;

export type SessionProcessExecutionStatus =
  'PLANNED' | 'IN_PROGRESS' | 'CONSOLIDATING' | 'PENDING_APPROVAL' | 'CLOSED' | 'VOIDED';

export interface SessionProcessExecutionRef {
  readonly id: string;
  readonly name: string;
  readonly status: SessionProcessExecutionStatus;
}

/**
 * Validates that a session is linked to at least one unique process execution
 * and that every linked execution is in an open status (PLANNED or IN_PROGRESS).
 */
export function assertExecutionsLinkable(executions: readonly SessionProcessExecutionRef[]): void {
  if (executions.length === 0) {
    throw new InvalidSessionDataError(
      'La sesión debe estar vinculada a al menos una ejecución de proceso',
    );
  }

  const seen = new Set<string>();
  for (const execution of executions) {
    if (seen.has(execution.id)) {
      throw new InvalidSessionDataError(
        'No se pueden vincular ejecuciones de proceso repetidas en la misma sesión',
      );
    }
    seen.add(execution.id);

    if (
      !LINKABLE_EXECUTION_STATUSES.includes(
        execution.status as (typeof LINKABLE_EXECUTION_STATUSES)[number],
      )
    ) {
      throw new SessionExecutionNotOpenError(execution.name, execution.status);
    }
  }
}
