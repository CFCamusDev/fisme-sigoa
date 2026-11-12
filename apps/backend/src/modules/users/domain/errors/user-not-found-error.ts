import { NotFoundError } from '../../../../shared/errors/app-error.js';

export class UserNotFoundError extends NotFoundError {
  constructor(message = 'Usuario no encontrado.') {
    super(message);
  }
}
