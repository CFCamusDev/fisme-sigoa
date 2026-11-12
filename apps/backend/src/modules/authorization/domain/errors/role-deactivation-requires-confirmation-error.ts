import { ConflictError } from '../../../../shared/errors/app-error.js';

export class RoleDeactivationRequiresConfirmationError extends ConflictError {
  readonly userCount: number;

  constructor(userCount: number) {
    super(`El rol está asignado a ${userCount} usuario(s). Confirma para desactivarlo.`);
    this.name = 'RoleDeactivationRequiresConfirmationError';
    this.userCount = userCount;
  }
}
