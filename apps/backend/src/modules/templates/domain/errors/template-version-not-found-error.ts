import { NotFoundError } from '../../../../shared/errors/app-error.js';

export class TemplateVersionNotFoundError extends NotFoundError {
  constructor(message = 'Versión de plantilla no encontrada.') {
    super(message);
  }
}
