import type { ValidationDetail } from '@sigoa/shared';
import { ValidationError } from '../../../../shared/errors/app-error.js';

export class InvalidParameterDataError extends ValidationError {
  constructor(
    message = 'Los datos del parámetro contienen errores de validación.',
    details?: ValidationDetail[],
  ) {
    super(message, details);
  }
}
