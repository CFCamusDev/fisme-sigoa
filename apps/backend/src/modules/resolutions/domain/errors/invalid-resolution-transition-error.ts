import { ConflictError } from '../../../../shared/errors/app-error.js';

export class InvalidResolutionTransitionError extends ConflictError {
  constructor(message = 'La transición de estado de la resolución no está permitida.') {
    super(message);
  }
}
