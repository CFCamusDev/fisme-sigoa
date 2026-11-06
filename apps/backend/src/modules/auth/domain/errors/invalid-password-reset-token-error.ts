import { AppError } from '../../../../shared/errors/app-error.js';

export class InvalidPasswordResetTokenError extends AppError {
  constructor(message = 'El enlace no es válido o venció.') {
    super(message, 'INVALID_PASSWORD_RESET_TOKEN', 400);
    this.name = 'InvalidPasswordResetTokenError';
  }
}
