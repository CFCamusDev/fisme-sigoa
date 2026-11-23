import { ConflictError } from '../../../../shared/errors/app-error.js';

export class CatalogVersionResolutionExistsError extends ConflictError {
  constructor(message = 'Esta versión del catálogo ya tiene una resolución de ese tipo.') {
    super(message, [{ path: 'catalogVersionId', message }]);
  }
}
