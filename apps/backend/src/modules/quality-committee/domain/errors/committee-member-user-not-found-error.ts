import type { ValidationDetail } from '@sigoa/shared';
import { ConflictError } from '../../../../shared/errors/app-error.js';

export const COMMITTEE_MEMBER_USER_NOT_FOUND_MESSAGE =
  'Uno o más usuarios vinculados no existen o se encuentran inactivos.';

export interface CommitteeMemberUserNotFoundIssue {
  readonly index: number;
  readonly email?: string;
}

function buildIssueDetail(issue: CommitteeMemberUserNotFoundIssue): ValidationDetail {
  if (issue.email) {
    return {
      path: `members.${issue.index}.userEmail`,
      message: `No existe un usuario activo con el correo ${issue.email}. Revisa el correo o deja el vínculo vacío.`,
    };
  }
  return {
    path: `members.${issue.index}.userId`,
    message: `El usuario vinculado del miembro ${issue.index + 1} no existe o está inactivo.`,
  };
}

export class CommitteeMemberUserNotFoundError extends ConflictError {
  constructor(issues?: readonly CommitteeMemberUserNotFoundIssue[]) {
    if (!issues || issues.length === 0) {
      super(COMMITTEE_MEMBER_USER_NOT_FOUND_MESSAGE);
      return;
    }

    const details = issues.map(buildIssueDetail);
    const message = details.map((detail) => detail.message).join(' ');
    super(message, details);
  }
}
