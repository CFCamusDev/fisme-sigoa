import { ConflictError } from '../../../../shared/errors/app-error.js';

export class TemplateVersionNumberConflictError extends ConflictError {
  constructor(message = 'Ya existe una versión de la plantilla con ese número.') {
    super(message);
  }
}
