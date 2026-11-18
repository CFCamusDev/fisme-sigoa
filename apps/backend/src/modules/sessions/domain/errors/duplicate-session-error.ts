import { ConflictError } from '../../../../shared/errors/app-error.js';

export class DuplicateSessionError extends ConflictError {
  constructor(stakeholderType: string, sessionDate: string, startTime: string) {
    super(`Ya existe una sesión para «${stakeholderType}» el ${sessionDate} a las ${startTime}.`);
  }
}
