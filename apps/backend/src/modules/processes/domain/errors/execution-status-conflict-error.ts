import { ConflictError } from '../../../../shared/errors/app-error.js';

export class ExecutionStatusConflictError extends ConflictError {
  constructor(
    message = 'El estado de la ejecución cambió por otra operación concurrente. Actualiza e intenta nuevamente.',
  ) {
    super(message);
  }
}
