import { ValidationError } from '../../../../shared/errors/app-error.js';

export class InvalidProcessExecutionDataError extends ValidationError {
  constructor(message: string) {
    super(message);
  }
}
