import { ConflictError } from '../../../../shared/errors/app-error.js';

export class DuplicateResolutionError extends ConflictError {
  constructor(
    message = 'Ya existe una resolución con ese número y tipo, o la versión del catálogo ya tiene una resolución de ese tipo.',
  ) {
    super(message);
  }
}
