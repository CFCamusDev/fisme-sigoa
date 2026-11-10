import type { ValidationDetail } from '@sigoa/shared';
import { ValidationError } from '../../../../shared/errors/app-error.js';

export class InvalidSemesterDataError extends ValidationError {
  constructor(
    message = 'Los datos del semestre contienen errores de validación.',
    details?: ValidationDetail[],
  ) {
    super(message, details);
  }
}
