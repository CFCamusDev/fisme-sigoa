import { ConflictError } from '../../../../shared/errors/app-error.js';

export class CatalogItemLimitReachedError extends ConflictError {
  constructor(message = 'Se alcanzó el máximo de elementos permitidos en la versión.') {
    super(message);
  }
}
