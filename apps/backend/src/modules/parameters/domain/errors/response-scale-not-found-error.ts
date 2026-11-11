import { NotFoundError } from '../../../../shared/errors/app-error.js';

export class ResponseScaleNotFoundError extends NotFoundError {
  constructor(message = 'Escala de respuesta no encontrada.') {
    super(message);
  }
}
