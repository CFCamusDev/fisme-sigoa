import { ConflictError } from '../../../../shared/errors/app-error.js';

export class TemplateVersionNotEditableError extends ConflictError {
  constructor(
    message = 'Solo se puede editar una versión de plantilla en Borrador. Esta versión está bloqueada.',
  ) {
    super(message);
  }
}
