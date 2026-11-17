import { ConflictError } from '../../../../shared/errors/app-error.js';

export class ProcessProgramNotConfiguredError extends ConflictError {
  constructor() {
    super('No existe un programa académico configurado en el sistema');
  }
}
