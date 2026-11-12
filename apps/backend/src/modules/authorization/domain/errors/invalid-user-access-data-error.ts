import type { ValidationDetail } from '@sigoa/shared';
import { ValidationError } from '../../../../shared/errors/app-error.js';

export class InvalidUserAccessDataError extends ValidationError {
  constructor(
    message = 'Los datos de acceso contienen errores de validación',
    details?: ValidationDetail[],
  ) {
    super(message, details);
  }
}
