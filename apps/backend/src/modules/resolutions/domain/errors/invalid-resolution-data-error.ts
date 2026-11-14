import type { ValidationDetail } from '@sigoa/shared';
import { ValidationError } from '../../../../shared/errors/app-error.js';

export class InvalidResolutionDataError extends ValidationError {
  constructor(
    message = 'Los datos de la resolución contienen errores de validación.',
    details?: ValidationDetail[],
  ) {
    super(message, details);
  }
}
