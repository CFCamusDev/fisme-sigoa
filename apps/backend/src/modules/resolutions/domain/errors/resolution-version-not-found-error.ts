import { NotFoundError } from '../../../../shared/errors/app-error.js';

export class ResolutionVersionNotFoundError extends NotFoundError {
  constructor(message = 'La versión del catálogo indicada no existe.') {
    super(message);
  }
}
