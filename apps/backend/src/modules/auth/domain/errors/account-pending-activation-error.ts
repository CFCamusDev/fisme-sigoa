import { AppError } from '../../../../shared/errors/app-error.js';

export class AccountPendingActivationError extends AppError {
  constructor() {
    super(
      'Tu cuenta está pendiente de activación. Revisa tu correo institucional para definir tu contraseña.',
      'ACCOUNT_PENDING_ACTIVATION',
      403,
    );
    this.name = 'AccountPendingActivationError';
  }
}
