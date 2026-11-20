import { qualityCommitteeSchema, type QualityCommitteeDto } from '@sigoa/shared';
import type { CommitteeMember } from '../domain/entities/committee-member.js';
import type { CommitteeMemberPosition } from '../domain/entities/committee-member-position.js';
import type { QualityCommittee } from '../domain/entities/quality-committee.js';
import { isInForce } from '../domain/policies/committee-period.js';
import type { CommitteeUserRef } from '../domain/ports/committee-user-reader.js';

export interface CommitteeMemberSnapshotItem {
  readonly fullName: string;
  readonly degree: string;
  readonly position: CommitteeMemberPosition;
  readonly userId: string | null;
}

function positionRank(position: CommitteeMemberPosition): number {
  return position === 'PRESIDENT' ? 0 : 1;
}

export function compareCommitteeMembers(
  a: CommitteeMemberSnapshotItem,
  b: CommitteeMemberSnapshotItem,
): number {
  const byPosition = positionRank(a.position) - positionRank(b.position);
  if (byPosition !== 0) {
    return byPosition;
  }

  const byName = a.fullName.localeCompare(b.fullName, 'es');
  if (byName !== 0) {
    return byName;
  }

  const byDegree = a.degree.localeCompare(b.degree, 'es');
  if (byDegree !== 0) {
    return byDegree;
  }

  return (a.userId ?? '').localeCompare(b.userId ?? '', 'en');
}

export function snapshotCommitteeMembers(
  members: readonly CommitteeMemberSnapshotItem[],
): CommitteeMemberSnapshotItem[] {
  return members
    .map((member) => ({
      fullName: member.fullName,
      degree: member.degree,
      position: member.position,
      userId: member.userId,
    }))
    .sort(compareCommitteeMembers);
}

export function snapshotCommittee(
  committee: QualityCommittee,
  members: readonly CommitteeMemberSnapshotItem[],
): Record<string, unknown> {
  return {
    id: committee.id,
    programId: committee.programId,
    periodStart: committee.periodStart,
    periodEnd: committee.periodEnd,
    members: snapshotCommitteeMembers(members),
  };
}

export interface BuildQualityCommitteeDtoParams {
  readonly committee: QualityCommittee;
  readonly members: readonly CommitteeMember[];
  readonly usersById: ReadonlyMap<string, CommitteeUserRef>;
  readonly today: string;
}

export function buildQualityCommitteeDto({
  committee,
  members,
  usersById,
  today,
}: BuildQualityCommitteeDtoParams): QualityCommitteeDto {
  const orderedMembers = [...members].sort(compareCommitteeMembers);

  return qualityCommitteeSchema.parse({
    id: committee.id,
    periodStart: committee.periodStart,
    periodEnd: committee.periodEnd,
    isCurrent: isInForce(committee, today),
    members: orderedMembers.map((member) => ({
      id: member.id,
      fullName: member.fullName,
      degree: member.degree,
      position: member.position,
      userId: member.userId,
      linkedUserName: member.userId ? (usersById.get(member.userId)?.fullName ?? null) : null,
    })),
  });
}
