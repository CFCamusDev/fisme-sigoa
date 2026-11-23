import { ConflictError } from '../../../../shared/errors/app-error.js';

export class DuplicateResolutionNumberError extends ConflictError {
  constructor(message = 'Ya existe una resolución con ese número para este tipo.') {
    super(message, [{ path: 'number', message }]);
  }
}
