import { NotFoundError } from '../../../../shared/errors/app-error.js';

export class StakeholderNotFoundError extends NotFoundError {
  constructor(message = 'No se encontró el constituyente solicitado.') {
    super(message);
  }
}
