import { ConflictError } from '../../../../shared/errors/app-error.js';

export class RoleAlreadyExistsError extends ConflictError {
  constructor(message = 'Ya existe un rol con ese nombre.') {
    super(message);
  }
}
