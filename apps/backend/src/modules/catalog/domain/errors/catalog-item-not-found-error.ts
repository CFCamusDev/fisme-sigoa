import { NotFoundError } from '../../../../shared/errors/app-error.js';

export class CatalogItemNotFoundError extends NotFoundError {
  constructor(message = 'El elemento del catálogo no existe en esta versión.') {
    super(message);
  }
}
