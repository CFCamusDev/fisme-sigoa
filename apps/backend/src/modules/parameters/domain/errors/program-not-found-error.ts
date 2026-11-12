import { NotFoundError } from '../../../../shared/errors/app-error.js';

export class ProgramNotFoundError extends NotFoundError {
  constructor(message = 'Programa no encontrado.') {
    super(message);
  }
}
