import { ConflictError } from '../../../../shared/errors/app-error.js';

export class TemplatePreviewInProgressError extends ConflictError {
  constructor(message = 'Ya hay una vista previa en curso. Espera a que termine.') {
    super(message);
  }
}
