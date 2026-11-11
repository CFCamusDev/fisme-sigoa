import { ConflictError } from '../../../../shared/errors/app-error.js';

export class ResponseScaleCodeAlreadyExistsError extends ConflictError {
  constructor(message = 'Ya existe una escala de respuesta con el código especificado.') {
    super(message);
  }
}
