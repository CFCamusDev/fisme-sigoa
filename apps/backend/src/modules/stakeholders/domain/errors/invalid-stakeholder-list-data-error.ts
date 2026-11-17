import type { ValidationDetail } from '@sigoa/shared';
import { ValidationError } from '../../../../shared/errors/app-error.js';

export class InvalidStakeholderListDataError extends ValidationError {
  constructor(
    message = 'Los datos de la lista de constituyentes contienen errores de validación.',
    details?: ValidationDetail[],
  ) {
    super(message, details);
  }
}
