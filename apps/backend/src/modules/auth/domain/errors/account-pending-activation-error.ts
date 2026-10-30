import { ForbiddenError } from '../../../../shared/errors/app-error.js';

export class AccountPendingActivationError extends ForbiddenError {
  constructor() {
    super(
      'Tu cuenta está pendiente de activación. Revisa tu correo institucional para definir tu contraseña.',
    );
    this.name = 'AccountPendingActivationError';
  }
}
