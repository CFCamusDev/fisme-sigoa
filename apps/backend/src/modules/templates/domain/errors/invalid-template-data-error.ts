import type { ValidationDetail } from '@sigoa/shared';
import { ValidationError } from '../../../../shared/errors/app-error.js';

export class InvalidTemplateDataError extends ValidationError {
  constructor(
    message = 'Los datos de la plantilla contienen errores de validación.',
    details?: ValidationDetail[],
  ) {
    super(message, details);
  }
}
