import { ConflictError } from '../../../../shared/errors/app-error.js';

export class UserDniAlreadyExistsError extends ConflictError {
  constructor(message = 'Ya existe un usuario con ese DNI.') {
    super(message);
  }
}
