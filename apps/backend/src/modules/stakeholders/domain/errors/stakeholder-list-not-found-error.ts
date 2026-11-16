import { NotFoundError } from '../../../../shared/errors/app-error.js';

export class StakeholderListNotFoundError extends NotFoundError {
  constructor(message = 'Lista de constituyentes no encontrada.') {
    super(message);
  }
}
