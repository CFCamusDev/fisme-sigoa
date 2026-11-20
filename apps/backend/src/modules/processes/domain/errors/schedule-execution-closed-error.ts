import { ConflictError } from '../../../../shared/errors/app-error.js';
import type { ProcessExecutionStatus } from '../entities/process-execution-status.js';

const STATUS_LABELS: Record<Extract<ProcessExecutionStatus, 'CLOSED' | 'VOIDED'>, string> = {
  CLOSED: 'Cerrada',
  VOIDED: 'Anulada',
};

export class ScheduleExecutionClosedError extends ConflictError {
  constructor(status: Extract<ProcessExecutionStatus, 'CLOSED' | 'VOIDED'>) {
    super(
      `No se puede modificar el cronograma porque la ejecución está en estado ${STATUS_LABELS[status]}.`,
    );
  }
}
