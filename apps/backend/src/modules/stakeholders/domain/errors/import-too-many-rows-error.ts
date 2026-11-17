import { ValidationError } from '../../../../shared/errors/app-error.js';

export class ImportTooManyRowsError extends ValidationError {
  constructor(maxRows = 500) {
    super(`El archivo supera el límite máximo de ${maxRows} filas de datos permitidas.`);
  }
}
