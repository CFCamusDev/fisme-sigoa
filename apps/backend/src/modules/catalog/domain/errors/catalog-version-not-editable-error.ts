import { ConflictError } from '../../../../shared/errors/app-error.js';

export class CatalogVersionNotEditableError extends ConflictError {
  constructor(
    message = 'Solo se puede editar una versión del catálogo en Borrador. Esta versión está bloqueada.',
  ) {
    super(message);
  }
}
