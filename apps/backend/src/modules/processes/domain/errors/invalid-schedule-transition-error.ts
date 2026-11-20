import { ConflictError } from '../../../../shared/errors/app-error.js';

export class InvalidScheduleTransitionError extends ConflictError {
  constructor(message: string) {
    super(message);
  }
}
