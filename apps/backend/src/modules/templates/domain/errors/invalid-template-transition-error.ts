import { ConflictError } from '../../../../shared/errors/app-error.js';

export class InvalidTemplateTransitionError extends ConflictError {
  constructor(
    message = 'La transición de estado de la versión de la plantilla no está permitida.',
  ) {
    super(message);
  }
}
