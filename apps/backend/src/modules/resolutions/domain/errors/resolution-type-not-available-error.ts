import { ValidationError } from '../../../../shared/errors/app-error.js';

export class ResolutionTypeNotAvailableError extends ValidationError {
  constructor(message = 'Las resoluciones de Plan de Mejora aún no están disponibles.') {
    super(message);
  }
}
