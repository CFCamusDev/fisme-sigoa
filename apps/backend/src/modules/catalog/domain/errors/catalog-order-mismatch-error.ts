import { ConflictError } from '../../../../shared/errors/app-error.js';

export class CatalogOrderMismatchError extends ConflictError {
  constructor(
    message = 'La lista cambió mientras la ordenabas. Recarga la página e inténtalo de nuevo.',
  ) {
    super(message);
  }
}
