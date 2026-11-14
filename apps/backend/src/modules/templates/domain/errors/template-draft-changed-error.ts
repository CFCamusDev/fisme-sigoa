import { ConflictError } from '../../../../shared/errors/app-error.js';

export class TemplateDraftChangedError extends ConflictError {
  constructor(
    message = 'El borrador cambió desde que lo revisaste. Actualiza la pantalla y revísalo antes de publicar.',
  ) {
    super(message);
  }
}
