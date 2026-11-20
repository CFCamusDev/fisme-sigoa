import type { CommitteeMemberPosition } from '../entities/committee-member-position.js';

export interface PresidentRoleHolder {
  readonly userId: string;
  readonly fullName: string;
}

export interface PresidentRoleAlert {
  readonly userId: string;
  readonly fullName: string;
}

export interface PresidentAlertCommitteeMember {
  readonly position: CommitteeMemberPosition;
  readonly userId: string | null;
}

export interface ComputePresidentAlertsParams {
  readonly roleHolders: readonly PresidentRoleHolder[];
  readonly committeeMembers: readonly PresidentAlertCommitteeMember[] | null;
}

/**
 * Computes alerts for users holding the active Committee President role who are not
 * the linked President of the currently active Quality Committee (HU-025, RS-017, CA3).
 */
export function computePresidentAlerts({
  roleHolders,
  committeeMembers,
}: ComputePresidentAlertsParams): PresidentRoleAlert[] {
  if (roleHolders.length === 0) {
    return [];
  }

  const currentPresidentUserId =
    committeeMembers?.find((member) => member.position === 'PRESIDENT')?.userId ?? null;

  return roleHolders
    .filter((holder) => holder.userId !== currentPresidentUserId)
    .map((holder) => ({
      userId: holder.userId,
      fullName: holder.fullName,
    }))
    .sort((a, b) => {
      const byName = a.fullName.localeCompare(b.fullName, 'es');
      if (byName !== 0) {
        return byName;
      }
      return a.userId.localeCompare(b.userId, 'en');
    });
}
