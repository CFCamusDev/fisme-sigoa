import { ConflictError } from '../../../../shared/errors/app-error.js';

export class DuplicateProcessExecutionError extends ConflictError {
  constructor(name: string) {
    super(
      `Ya existe una ejecución de proceso activa con el nombre «${name}». Indica otro nombre para continuar.`,
    );
  }
}
