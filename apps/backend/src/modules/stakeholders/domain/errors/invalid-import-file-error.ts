import { ValidationError } from '../../../../shared/errors/app-error.js';

export class InvalidImportFileError extends ValidationError {
  constructor(
    message = 'El archivo enviado no es un libro Excel (.xlsx) válido o no contiene datos.',
  ) {
    super(message);
  }
}
