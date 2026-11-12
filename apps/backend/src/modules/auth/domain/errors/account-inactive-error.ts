import { AppError } from '../../../../shared/errors/app-error.js';

export class AccountInactiveError extends AppError {
  constructor() {
    super(
      'Tu cuenta se encuentra inactiva. Comunícate con el Administrador del sistema.',
      'ACCOUNT_INACTIVE',
      403,
    );
    this.name = 'AccountInactiveError';
  }
}
