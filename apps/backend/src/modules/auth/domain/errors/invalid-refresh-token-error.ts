import { UnauthorizedError } from '../../../../shared/errors/app-error.js';

export class InvalidRefreshTokenError extends UnauthorizedError {
  constructor() {
    super('La sesión expiró o ya no es válida. Inicia sesión nuevamente.');
    this.name = 'InvalidRefreshTokenError';
  }
}
