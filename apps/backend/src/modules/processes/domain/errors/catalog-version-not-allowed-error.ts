import { ConflictError } from '../../../../shared/errors/app-error.js';

export class CatalogVersionNotAllowedError extends ConflictError {
  constructor(message: string) {
    super(message);
  }
}
