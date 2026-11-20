import { ValidationError } from '../../../../shared/errors/app-error.js';

export class InvalidScheduleDataError extends ValidationError {
  constructor(message: string) {
    super(message);
  }
}
