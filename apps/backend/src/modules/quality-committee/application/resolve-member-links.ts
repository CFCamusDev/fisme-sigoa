import type { CommitteeMemberInput } from '@sigoa/shared';
import {
  CommitteeMemberUserNotFoundError,
  InvalidQualityCommitteeDataError,
  type CommitteeMemberUserNotFoundIssue,
} from '../domain/errors/index.js';
import {
  assertCommitteeComposition,
  type NormalizedCommitteeMember,
} from '../domain/policies/committee-composition.js';
import type { CommitteeUserReader, CommitteeUserRef } from '../domain/ports/index.js';

export interface ResolveCommitteeMembersParams {
  readonly members: readonly CommitteeMemberInput[];
  readonly committeeUserReader: CommitteeUserReader;
}

export interface ResolvedCommitteeMembers {
  readonly entries: NormalizedCommitteeMember[];
  readonly usersById: ReadonlyMap<string, CommitteeUserRef>;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function resolveCommitteeMembers({
  members,
  committeeUserReader,
}: ResolveCommitteeMembersParams): Promise<ResolvedCommitteeMembers> {
  const prepared = members.map((member) => {
    const userId = normalizeOptionalText(member.userId);
    const userEmail = normalizeOptionalText(member.userEmail)?.toLowerCase() ?? null;

    if (userId && userEmail) {
      throw new InvalidQualityCommitteeDataError(
        'Indica solo el identificador o el correo electrónico del usuario, no ambos.',
      );
    }

    return {
      fullName: member.fullName,
      degree: member.degree,
      position: member.position,
      userId,
      userEmail,
    };
  });

  const requestedIds = prepared
    .map((item) => item.userId)
    .filter((id): id is string => id !== null);
  const requestedEmails = prepared
    .map((item) => item.userEmail)
    .filter((email): email is string => email !== null);

  const [usersFoundById, usersFoundByEmail] = await Promise.all([
    requestedIds.length > 0 ? committeeUserReader.findByIds(requestedIds) : Promise.resolve([]),
    requestedEmails.length > 0
      ? committeeUserReader.findByEmails(requestedEmails)
      : Promise.resolve(new Map<string, CommitteeUserRef>()),
  ]);

  const usersById = new Map<string, CommitteeUserRef>();
  for (const user of usersFoundById) {
    usersById.set(user.id, user);
  }
  for (const user of usersFoundByEmail.values()) {
    usersById.set(user.id, user);
  }

  const notFoundIssues: CommitteeMemberUserNotFoundIssue[] = [];

  const resolvedInputs = prepared.map((item, index) => {
    if (item.userId !== null) {
      const user = usersById.get(item.userId);
      if (!user || user.status === 'INACTIVE') {
        notFoundIssues.push({ index });
        return null;
      }
      return {
        fullName: item.fullName,
        degree: item.degree,
        position: item.position,
        userId: user.id,
      };
    }

    if (item.userEmail !== null) {
      const user = usersFoundByEmail.get(item.userEmail);
      if (!user || user.status === 'INACTIVE') {
        notFoundIssues.push({ index, email: item.userEmail });
        return null;
      }
      return {
        fullName: item.fullName,
        degree: item.degree,
        position: item.position,
        userId: user.id,
      };
    }

    return {
      fullName: item.fullName,
      degree: item.degree,
      position: item.position,
      userId: null,
    };
  });

  if (notFoundIssues.length > 0) {
    throw new CommitteeMemberUserNotFoundError(notFoundIssues);
  }

  const entries = assertCommitteeComposition({
    members: resolvedInputs.filter((entry): entry is NonNullable<typeof entry> => entry !== null),
  });

  return {
    entries,
    usersById,
  };
}
