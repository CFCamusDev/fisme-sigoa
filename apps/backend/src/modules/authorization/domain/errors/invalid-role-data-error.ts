import type { ValidationDetail } from '@sigoa/shared';
import { ValidationError } from '../../../../shared/errors/app-error.js';

export class InvalidRoleDataError extends ValidationError {
  constructor(
    message = 'Los datos del rol contienen errores de validación',
    details?: ValidationDetail[],
  ) {
    super(message, details);
  }
}
