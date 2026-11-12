import type { ValidationDetail } from '@sigoa/shared';
import { ValidationError } from '../../../../shared/errors/app-error.js';

export class InvalidUserDataError extends ValidationError {
  constructor(
    message = 'Los datos del usuario contienen errores de validación',
    details?: ValidationDetail[],
  ) {
    super(message, details);
  }
}
