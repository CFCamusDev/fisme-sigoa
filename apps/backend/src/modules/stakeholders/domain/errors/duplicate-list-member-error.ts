import { ConflictError } from '../../../../shared/errors/app-error.js';

export class DuplicateListMemberError extends ConflictError {
  constructor(message = 'El constituyente ya forma parte de esta lista.') {
    super(message);
  }
}
