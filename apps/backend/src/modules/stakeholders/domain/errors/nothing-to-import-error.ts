import { ValidationError } from '../../../../shared/errors/app-error.js';

export class NothingToImportError extends ValidationError {
  constructor(message = 'No hay filas válidas nuevas o reutilizables para importar.') {
    super(message);
  }
}
