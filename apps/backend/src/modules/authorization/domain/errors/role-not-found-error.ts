import { NotFoundError } from '../../../../shared/errors/app-error.js';

export class RoleNotFoundError extends NotFoundError {
  constructor(message = 'Rol no encontrado.') {
    super(message);
  }
}
