import { NotFoundError } from '../../../../shared/errors/app-error.js';

export class ParameterSemesterNotFoundError extends NotFoundError {
  constructor(message = 'El semestre indicado no existe.') {
    super(message);
  }
}
