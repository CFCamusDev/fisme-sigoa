import { ConflictError } from '../../../../shared/errors/app-error.js';

export class InvalidCatalogTransitionError extends ConflictError {
  constructor(message = 'La transición de estado de la versión del catálogo no está permitida.') {
    super(message);
  }
}
