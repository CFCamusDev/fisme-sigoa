import { ConflictError } from '../../../../shared/errors/app-error.js';

export class IneligibleListMemberError extends ConflictError {
  constructor(message = 'No se puede agregar un constituyente anulado a la lista.') {
    super(message);
  }
}
