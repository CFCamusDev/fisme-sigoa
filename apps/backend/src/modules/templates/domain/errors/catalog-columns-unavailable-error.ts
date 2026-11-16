import { ConflictError } from '../../../../shared/errors/app-error.js';

/** Error lanzado cuando no existe un catálogo vigente para generar columnas de OE y AG. */
export class CatalogColumnsUnavailableError extends ConflictError {
  constructor(message = 'No hay un catálogo vigente del cual generar las columnas de OE y AG.') {
    super(message);
  }
}
