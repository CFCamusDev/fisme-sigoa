import { NotFoundError } from '../../../../shared/errors/app-error.js';

export class TemplateNotFoundError extends NotFoundError {
  constructor(message = 'Plantilla no encontrada.') {
    super(message);
  }
}
