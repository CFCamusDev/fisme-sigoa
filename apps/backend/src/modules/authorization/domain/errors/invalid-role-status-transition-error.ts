import { ConflictError } from '../../../../shared/errors/app-error.js';

export class InvalidRoleStatusTransitionError extends ConflictError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRoleStatusTransitionError';
  }
}
