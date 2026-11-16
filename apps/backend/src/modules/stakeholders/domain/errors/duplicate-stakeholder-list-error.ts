import { ConflictError } from '../../../../shared/errors/app-error.js';

export class DuplicateStakeholderListError extends ConflictError {
  constructor(message = 'Ya existe una lista para ese tipo y año en el programa.') {
    super(message);
  }
}
