import { ValidationError } from '../../../../shared/errors/app-error.js';
import type { ValidationDetail } from '@sigoa/shared';

export class WeakPasswordError extends ValidationError {
  constructor(
    details: ValidationDetail[],
    message = 'La contraseña no cumple con la política de seguridad',
  ) {
    super(message, details);
    this.name = 'WeakPasswordError';
  }
}
