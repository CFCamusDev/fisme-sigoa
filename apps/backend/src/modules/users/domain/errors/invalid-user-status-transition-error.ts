import { ConflictError } from '../../../../shared/errors/app-error.js';

export class InvalidUserStatusTransitionError extends ConflictError {
  constructor(message = 'Transición de estado de usuario inválida.') {
    super(message);
  }
}
