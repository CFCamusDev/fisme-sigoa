import { NotFoundError } from '../../../../shared/errors/app-error.js';

export class ResolutionNotFoundError extends NotFoundError {
  constructor(message = 'Resolución no encontrada.') {
    super(message);
  }
}
