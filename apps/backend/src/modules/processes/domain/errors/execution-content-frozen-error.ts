import { ConflictError } from '../../../../shared/errors/app-error.js';
import type { ProcessExecutionStatus } from '../entities/process-execution-status.js';

const STATUS_LABELS: Record<Extract<ProcessExecutionStatus, 'CLOSED' | 'VOIDED'>, string> = {
  CLOSED: 'Cerrada',
  VOIDED: 'Anulada',
};

export class ExecutionContentFrozenError extends ConflictError {
  constructor(status: Extract<ProcessExecutionStatus, 'CLOSED' | 'VOIDED'>) {
    super(`La ejecución está ${STATUS_LABELS[status]} y su contenido no se puede modificar.`);
  }
}
