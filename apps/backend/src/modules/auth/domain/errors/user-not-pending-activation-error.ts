import { ConflictError } from '../../../../shared/errors/app-error.js';

export class UserNotPendingActivationError extends ConflictError {
  constructor(message = 'El usuario no se encuentra en estado pendiente de activación.') {
    super(message);
    this.name = 'UserNotPendingActivationError';
  }
}
