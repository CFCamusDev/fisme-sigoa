import { ConflictError } from '../../../../shared/errors/app-error.js';

export class DuplicateCatalogCodeError extends ConflictError {
  constructor(message = 'Ya existe un elemento con ese código en la versión del catálogo.') {
    super(message);
  }
}
