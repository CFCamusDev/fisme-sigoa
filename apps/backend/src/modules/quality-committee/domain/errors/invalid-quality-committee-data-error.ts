import { ValidationError } from '../../../../shared/errors/app-error.js';

export class InvalidQualityCommitteeDataError extends ValidationError {
  constructor(message: string) {
    super(message);
  }
}
