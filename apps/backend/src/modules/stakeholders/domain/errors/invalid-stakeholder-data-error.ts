import type { ValidationDetail } from '@sigoa/shared';
import { ValidationError } from '../../../../shared/errors/app-error.js';

export class InvalidStakeholderDataError extends ValidationError {
  constructor(
    message = 'Los datos del constituyente contienen errores de validación.',
    details?: ValidationDetail[],
  ) {
    super(message, details);
  }
}
