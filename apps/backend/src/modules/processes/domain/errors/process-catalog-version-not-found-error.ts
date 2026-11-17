import { NotFoundError } from '../../../../shared/errors/app-error.js';

export class ProcessCatalogVersionNotFoundError extends NotFoundError {
  constructor(catalogVersionId: string) {
    super(`No existe la versión de catálogo indicada (${catalogVersionId})`);
  }
}
