import { ConflictError } from '../../../../shared/errors/app-error.js';
import type { ErrorCode } from '@sigoa/shared';

export class UserNotActiveError extends ConflictError {
  constructor(message = 'El usuario no se encuentra activo.') {
    super(message);
    (this as { code: ErrorCode }).code = 'USER_NOT_ACTIVE' as ErrorCode;
    this.name = 'UserNotActiveError';
  }
}
