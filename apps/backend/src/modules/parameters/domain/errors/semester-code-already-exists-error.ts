import { ConflictError } from '../../../../shared/errors/app-error.js';

export class SemesterCodeAlreadyExistsError extends ConflictError {
  constructor(message = 'Ya existe un semestre con el código especificado.') {
    super(message);
  }
}
