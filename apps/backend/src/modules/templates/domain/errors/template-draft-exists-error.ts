import { ConflictError } from '../../../../shared/errors/app-error.js';

export class TemplateDraftExistsError extends ConflictError {
  constructor(
    message = 'La plantilla ya tiene un borrador. Actualiza la pantalla para ver los cambios.',
  ) {
    super(message);
  }
}
