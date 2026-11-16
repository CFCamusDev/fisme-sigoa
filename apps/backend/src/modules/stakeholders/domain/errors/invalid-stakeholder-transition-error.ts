import { ConflictError } from '../../../../shared/errors/app-error.js';

export class InvalidStakeholderTransitionError extends ConflictError {
  constructor(
    message = 'El constituyente está anulado y no admite modificaciones ni nuevas anulaciones.',
  ) {
    super(message);
  }
}
