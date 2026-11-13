import { ConflictError } from '../../../../shared/errors/app-error.js';

export class ResolutionVersionNotInValidationError extends ConflictError {
  constructor(
    message = 'Solo se puede registrar una resolución para una versión del catálogo En validación.',
  ) {
    super(message);
  }
}
