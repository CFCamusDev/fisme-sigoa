import { ConflictError } from '../../../../shared/errors/app-error.js';

export class StakeholderListProgramNotConfiguredError extends ConflictError {
  constructor(message = 'No hay un programa de estudios configurado en el sistema.') {
    super(message);
  }
}
