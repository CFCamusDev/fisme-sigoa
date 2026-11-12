import type { ValidationDetail } from '@sigoa/shared';
import { ValidationError } from '../../../../shared/errors/app-error.js';

export class InvalidCatalogDataError extends ValidationError {
  constructor(
    message = 'Los datos del catálogo contienen errores de validación.',
    details?: ValidationDetail[],
  ) {
    super(message, details);
  }
}
