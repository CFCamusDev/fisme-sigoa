import type { ValidationDetail } from '@sigoa/shared';
import { ValidationError } from '../../../../shared/errors/app-error.js';

export class InvalidProgramDataError extends ValidationError {
  constructor(
    message = 'Los datos del programa contienen errores de validación.',
    details?: ValidationDetail[],
  ) {
    super(message, details);
  }
}
