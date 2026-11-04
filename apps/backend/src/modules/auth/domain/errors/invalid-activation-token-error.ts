import { ValidationError } from '../../../../shared/errors/app-error.js';

export class InvalidActivationTokenError extends ValidationError {
  constructor(message = 'El enlace de activación es inválido o ha expirado.') {
    super(message);
    this.name = 'InvalidActivationTokenError';
  }
}
