import { ValidationError } from '../../../../shared/errors/app-error.js';

export class ImportTemplateMismatchError extends ValidationError {
  constructor(
    message = 'Los encabezados del archivo no corresponden a la plantilla del tipo de lista.',
  ) {
    super(message);
  }
}
