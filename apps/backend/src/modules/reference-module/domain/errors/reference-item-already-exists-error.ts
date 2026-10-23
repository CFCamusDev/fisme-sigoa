import { ConflictError } from '../../../../shared/errors/app-error.js';

export class ReferenceItemAlreadyExistsError extends ConflictError {
  constructor(code: string) {
    super(`Ya existe un ítem de referencia con el código "${code}".`);
    this.name = 'ReferenceItemAlreadyExistsError';
  }
}
