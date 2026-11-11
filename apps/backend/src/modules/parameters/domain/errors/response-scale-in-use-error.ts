import { ConflictError } from '../../../../shared/errors/app-error.js';

export class ResponseScaleInUseError extends ConflictError {
  constructor(
    message = 'La escala está en uso en una encuesta publicada y no se puede modificar. Duplícala para crear una nueva',
  ) {
    super(message);
  }
}
