import { AppError } from '../../../../shared/errors/app-error.js';

export class AccountLockedError extends AppError {
  constructor(retryAfterSeconds: number) {
    const minutes = Math.ceil(retryAfterSeconds / 60);
    super(
      `Tu cuenta ha sido bloqueada temporalmente por exceso de intentos fallidos. Por favor intenta nuevamente en ${minutes} minuto${minutes > 1 ? 's' : ''}.`,
      'ACCOUNT_LOCKED',
      429,
      undefined,
      retryAfterSeconds,
    );
    this.name = 'AccountLockedError';
  }
}
