import { ConflictError } from '../../../../shared/errors/app-error.js';

export class ProgramCodeAlreadyExistsError extends ConflictError {
  constructor(message = 'Ya existe un programa con el código especificado.') {
    super(message);
  }
}
