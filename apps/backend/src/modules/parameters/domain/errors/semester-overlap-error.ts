import { ConflictError } from '../../../../shared/errors/app-error.js';

export class SemesterOverlapError extends ConflictError {
  constructor(message = 'El rango de fechas del semestre se superpone con un semestre existente.') {
    super(message);
  }
}
