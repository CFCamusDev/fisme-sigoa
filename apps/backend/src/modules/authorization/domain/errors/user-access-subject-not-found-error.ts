import { NotFoundError } from '../../../../shared/errors/app-error.js';

export class UserAccessSubjectNotFoundError extends NotFoundError {
  constructor() {
    super('Usuario no encontrado.');
  }
}
