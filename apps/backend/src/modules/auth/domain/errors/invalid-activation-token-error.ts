import { AppError } from '../../../../shared/errors/app-error.js';

export class InvalidActivationTokenError extends AppError {
  constructor(message = 'El enlace no es válido o venció.') {
    super(message, 'INVALID_ACTIVATION_TOKEN', 400);
    this.name = 'InvalidActivationTokenError';
  }
}
