import { ConflictError } from '../../../../shared/errors/app-error.js';

export class CatalogVersionNumberConflictError extends ConflictError {
  constructor(message = 'El número de versión del catálogo ya está en uso. Inténtalo de nuevo.') {
    super(message);
  }
}
