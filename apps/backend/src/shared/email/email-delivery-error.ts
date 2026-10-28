import { AppError } from '../errors/app-error.js';

export class EmailDeliveryError extends AppError {
  constructor(message = 'Error al enviar el correo electrónico', cause?: unknown) {
    super(message, 'INTERNAL_ERROR', 500);
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}
