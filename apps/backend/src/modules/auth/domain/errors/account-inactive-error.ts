import { ForbiddenError } from '../../../../shared/errors/app-error.js';

export class AccountInactiveError extends ForbiddenError {
  constructor() {
    super('Tu cuenta se encuentra inactiva. Comunícate con el Administrador del sistema.');
    this.name = 'AccountInactiveError';
  }
}
