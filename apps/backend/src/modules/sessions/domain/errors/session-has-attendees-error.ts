import { ConflictError } from '../../../../shared/errors/app-error.js';

export class SessionHasAttendeesError extends ConflictError {
  constructor() {
    super(
      'No se puede cambiar la lista o el tipo de constituyente de una sesión que ya tiene asistentes registrados.',
    );
  }
}
