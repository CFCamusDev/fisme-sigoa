import { ConflictError } from '../../../../shared/errors/app-error.js';

export class UserEmailAlreadyExistsError extends ConflictError {
  constructor(message = 'Ya existe un usuario con ese correo.') {
    super(message);
  }
}
