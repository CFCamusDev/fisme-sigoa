import { ConflictError } from '../../../../shared/errors/app-error.js';

export class SessionWithoutListError extends ConflictError {
  constructor() {
    super(
      'La sesión no tiene una lista del Anexo 3 asignada; asigna una lista antes de registrar asistentes.',
    );
  }
}
