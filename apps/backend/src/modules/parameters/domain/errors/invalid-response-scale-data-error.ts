import type { ValidationDetail } from '@sigoa/shared';
import { ValidationError } from '../../../../shared/errors/app-error.js';

export class InvalidResponseScaleDataError extends ValidationError {
  constructor(
    message = 'Los datos de la escala de respuesta contienen errores de validación.',
    details?: ValidationDetail[],
  ) {
    super(message, details);
  }
}
