import { ValidationError } from '../../../../shared/errors/app-error.js';

export class InvalidSessionDataError extends ValidationError {
  constructor(message: string) {
    super(message);
  }
}
