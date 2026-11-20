import type { CommitteeMemberPosition } from '../entities/committee-member-position.js';
import { InvalidQualityCommitteeDataError } from '../errors/invalid-quality-committee-data-error.js';
import { QualityCommitteeClosedError } from '../errors/quality-committee-closed-error.js';
import { QualityCommitteeOverlapError } from '../errors/quality-committee-overlap-error.js';
import { periodsOverlap, type CommitteePeriod } from './committee-period.js';

export const COMMITTEE_MEMBERS_MIN = 1;
export const COMMITTEE_MEMBERS_MAX = 30;
export const COMMITTEE_MEMBER_NAME_MAX_LENGTH = 160;
export const COMMITTEE_MEMBER_DEGREE_MAX_LENGTH = 60;

export interface CommitteeMemberCompositionInput {
  readonly fullName: string;
  readonly degree: string;
  readonly position: CommitteeMemberPosition;
  readonly userId?: string | null;
}

export interface NormalizedCommitteeMember {
  readonly fullName: string;
  readonly degree: string;
  readonly position: CommitteeMemberPosition;
  readonly userId: string | null;
}

export function normalizeMember(input: CommitteeMemberCompositionInput): NormalizedCommitteeMember {
  const fullName = input.fullName.trim();
  if (fullName.length === 0) {
    throw new InvalidQualityCommitteeDataError('El nombre completo del miembro es obligatorio.');
  }
  if (fullName.length > COMMITTEE_MEMBER_NAME_MAX_LENGTH) {
    throw new InvalidQualityCommitteeDataError(
      `El nombre completo del miembro no puede superar los ${COMMITTEE_MEMBER_NAME_MAX_LENGTH} caracteres.`,
    );
  }

  const degree = input.degree.trim();
  if (degree.length === 0) {
    throw new InvalidQualityCommitteeDataError('El grado académico del miembro es obligatorio.');
  }
  if (degree.length > COMMITTEE_MEMBER_DEGREE_MAX_LENGTH) {
    throw new InvalidQualityCommitteeDataError(
      `El grado académico del miembro no puede superar los ${COMMITTEE_MEMBER_DEGREE_MAX_LENGTH} caracteres.`,
    );
  }

  const trimmedUserId = input.userId?.trim() ?? '';
  const userId = trimmedUserId.length > 0 ? trimmedUserId : null;

  return {
    fullName,
    degree,
    position: input.position,
    userId,
  };
}

export interface AssertCommitteeCompositionParams {
  readonly members: readonly CommitteeMemberCompositionInput[];
}

export function assertCommitteeComposition({
  members,
}: AssertCommitteeCompositionParams): NormalizedCommitteeMember[] {
  if (members.length < COMMITTEE_MEMBERS_MIN) {
    throw new InvalidQualityCommitteeDataError(
      'El Comité de Calidad debe tener al menos un miembro.',
    );
  }

  if (members.length > COMMITTEE_MEMBERS_MAX) {
    throw new InvalidQualityCommitteeDataError(
      `El Comité de Calidad no puede superar los ${COMMITTEE_MEMBERS_MAX} miembros.`,
    );
  }

  const normalized: NormalizedCommitteeMember[] = [];
  const seenUserIds = new Set<string>();
  let presidentCount = 0;

  for (const member of members) {
    const entry = normalizeMember(member);

    if (entry.position === 'PRESIDENT') {
      presidentCount += 1;
    }

    if (entry.userId !== null) {
      if (seenUserIds.has(entry.userId)) {
        throw new InvalidQualityCommitteeDataError(
          'Un mismo usuario no puede vincularse más de una vez en el mismo Comité de Calidad.',
        );
      }
      seenUserIds.add(entry.userId);
    }

    normalized.push(entry);
  }

  if (presidentCount !== 1) {
    throw new InvalidQualityCommitteeDataError(
      'El Comité de Calidad debe tener exactamente un Presidente.',
    );
  }

  return normalized;
}

export interface AssertNoOverlapParams {
  readonly period: CommitteePeriod;
  readonly existing: readonly CommitteePeriod[];
}

export function assertNoOverlap({ period, existing }: AssertNoOverlapParams): void {
  const conflict = existing.find((current) => periodsOverlap(period, current));
  if (conflict) {
    throw new QualityCommitteeOverlapError(conflict.periodStart, conflict.periodEnd);
  }
}

export interface AssertCommitteeEditableParams {
  readonly period: CommitteePeriod;
  readonly today: string;
}

export function assertCommitteeEditable({ period, today }: AssertCommitteeEditableParams): void {
  if (period.periodEnd < today) {
    throw new QualityCommitteeClosedError(period.periodStart, period.periodEnd);
  }
}
