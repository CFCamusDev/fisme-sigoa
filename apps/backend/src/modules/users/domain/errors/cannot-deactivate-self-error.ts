import { ConflictError } from '../../../../shared/errors/app-error.js';

export class CannotDeactivateSelfError extends ConflictError {
  public constructor() {
    super('No puedes inactivar tu propia cuenta de usuario');
  }
}
