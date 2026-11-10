import { ConflictError } from '../../../../shared/errors/app-error.js';

export class ParameterConflictError extends ConflictError {
  constructor(message = 'Ya existe una versión de este parámetro para el semestre indicado.') {
    super(message);
  }
}
