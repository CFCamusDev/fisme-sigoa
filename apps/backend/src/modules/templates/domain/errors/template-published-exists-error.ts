import { ConflictError } from '../../../../shared/errors/app-error.js';

export class TemplatePublishedExistsError extends ConflictError {
  constructor(message = 'La plantilla ya tiene una versión publicada vigente.') {
    super(message);
  }
}
