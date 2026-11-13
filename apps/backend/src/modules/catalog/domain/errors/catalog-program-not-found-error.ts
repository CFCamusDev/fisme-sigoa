import { NotFoundError } from '../../../../shared/errors/app-error.js';

export class CatalogProgramNotFoundError extends NotFoundError {
  constructor(message = 'No hay un programa de estudios configurado para el catálogo.') {
    super(message);
  }
}
