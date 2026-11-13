import { NotFoundError } from '../../../../shared/errors/app-error.js';

export class CatalogVersionNotFoundError extends NotFoundError {
  constructor(message = 'Versión del catálogo no encontrada.') {
    super(message);
  }
}
