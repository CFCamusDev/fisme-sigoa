import { ConflictError } from '../../../../shared/errors/app-error.js';

export const COMMITTEE_MEMBER_USER_NOT_FOUND_MESSAGE =
  'Uno o más usuarios vinculados no existen o se encuentran inactivos.';

export class CommitteeMemberUserNotFoundError extends ConflictError {
  constructor() {
    super(COMMITTEE_MEMBER_USER_NOT_FOUND_MESSAGE);
  }
}
