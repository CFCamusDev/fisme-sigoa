import { ConflictError } from '../../../../shared/errors/app-error.js';

export class SessionStakeholderListMismatchError extends ConflictError {
  constructor(listType: string, sessionType: string) {
    super(
      `La lista de constituyentes (${listType}) no corresponde al tipo de constituyente de la sesión (${sessionType}).`,
    );
  }
}
