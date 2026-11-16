import { ConflictError } from '../../../../shared/errors/app-error.js';

export class DuplicateStakeholderError extends ConflictError {
  constructor(message = 'Ya existe un constituyente registrado con ese DNI o RUC.') {
    super(message);
  }
}
