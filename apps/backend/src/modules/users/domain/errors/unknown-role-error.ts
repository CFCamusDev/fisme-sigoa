import { ValidationError } from '../../../../shared/errors/app-error.js';

export class UnknownRoleError extends ValidationError {
  constructor(message = 'Uno o más roles especificados no existen') {
    super(message);
  }
}
