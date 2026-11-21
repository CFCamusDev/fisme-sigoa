import { ConflictError } from '../../../../shared/errors/app-error.js';

export class InvalidExecutionTransitionError extends ConflictError {
  constructor(message: string) {
    super(message);
  }
}
