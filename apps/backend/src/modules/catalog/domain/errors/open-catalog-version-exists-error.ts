import { ConflictError } from '../../../../shared/errors/app-error.js';

export class OpenCatalogVersionExistsError extends ConflictError {
  constructor(
    message = 'Ya existe una versión del catálogo en Borrador o En validación. Ciérrala o apruébala antes de crear otra.',
  ) {
    super(message);
  }
}
