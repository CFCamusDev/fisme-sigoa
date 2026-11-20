import type { CommitteeMemberPositionDto } from '@sigoa/shared';

export const COMMITTEE_POSITION_LABELS: Record<CommitteeMemberPositionDto, string> = {
  PRESIDENT: 'Presidente',
  MEMBER: 'Miembro',
};

export function getCommitteePositionLabel(position: CommitteeMemberPositionDto): string {
  return COMMITTEE_POSITION_LABELS[position];
}
