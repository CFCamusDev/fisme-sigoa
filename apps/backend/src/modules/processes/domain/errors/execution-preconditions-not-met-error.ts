import { AppError } from '../../../../shared/errors/app-error.js';
import type { ExecutionPreconditionResult } from '../entities/process-execution-precondition.js';

export class ExecutionPreconditionsNotMetError extends AppError {
  public readonly unmetPreconditions: readonly ExecutionPreconditionResult[];

  constructor(unmetPreconditions: readonly ExecutionPreconditionResult[]) {
    super(
      'No se puede avanzar la ejecución porque faltan precondiciones por cumplir',
      'CONFLICT',
      409,
      unmetPreconditions.map((item) => ({
        path: item.code,
        message: item.state === 'NOT_VERIFIABLE' ? `${item.label} (no verificable)` : item.label,
      })),
    );
    this.unmetPreconditions = unmetPreconditions;
  }
}
