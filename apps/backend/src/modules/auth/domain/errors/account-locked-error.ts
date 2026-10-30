import { ForbiddenError } from '../../../../shared/errors/app-error.js';

export class AccountLockedError extends ForbiddenError {
  public readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    const minutes = Math.ceil(retryAfterSeconds / 60);
    super(
      `Tu cuenta ha sido bloqueada temporalmente por exceso de intentos fallidos. Por favor intenta nuevamente en ${minutes} minuto${minutes > 1 ? 's' : ''}.`,
    );
    this.name = 'AccountLockedError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
