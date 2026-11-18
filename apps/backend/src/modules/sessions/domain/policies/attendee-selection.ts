import { AttendeeNotInListError } from '../errors/attendee-not-in-list-error.js';
import { InvalidSessionDataError } from '../errors/invalid-session-data-error.js';
import { SessionWithoutListError } from '../errors/session-without-list-error.js';

export const SESSION_ATTENDEES_MAX = 500;
export const SESSION_ATTENDEE_POSITION_MAX_LENGTH = 120;

export interface AttendeeSelectionInput {
  readonly listMemberId: string;
  readonly position?: string | null;
}

export interface SessionListMemberRef {
  readonly id: string;
  readonly listId: string;
  readonly fullName?: string;
}

export interface NormalizedAttendeeEntry {
  readonly listMemberId: string;
  readonly position: string | null;
}

export interface AssertAttendeesInSessionListParams {
  readonly sessionListId: string | null;
  readonly entries: readonly AttendeeSelectionInput[];
  readonly listMembers: readonly SessionListMemberRef[];
}

/**
 * Validates that a session has an assigned Anexo 3 list, enforces uniqueness and max count,
 * verifies each selected member belongs to that list, and normalizes optional positions.
 */
export function assertAttendeesInSessionList({
  sessionListId,
  entries,
  listMembers,
}: AssertAttendeesInSessionListParams): NormalizedAttendeeEntry[] {
  if (!sessionListId) {
    throw new SessionWithoutListError();
  }

  if (entries.length > SESSION_ATTENDEES_MAX) {
    throw new InvalidSessionDataError(
      `No se pueden registrar más de ${SESSION_ATTENDEES_MAX} asistentes por sesión.`,
    );
  }

  const membersById = new Map(listMembers.map((member) => [member.id, member]));
  const seen = new Set<string>();
  const normalized: NormalizedAttendeeEntry[] = [];

  for (const entry of entries) {
    if (seen.has(entry.listMemberId)) {
      throw new InvalidSessionDataError(
        'No se pueden registrar asistentes repetidos en la sesión.',
      );
    }
    seen.add(entry.listMemberId);

    const member = membersById.get(entry.listMemberId);
    if (!member || member.listId !== sessionListId) {
      throw new AttendeeNotInListError(member?.fullName ?? entry.listMemberId);
    }

    const trimmedPosition = entry.position?.trim() ?? '';
    const position = trimmedPosition.length > 0 ? trimmedPosition : null;
    if (position !== null && position.length > SESSION_ATTENDEE_POSITION_MAX_LENGTH) {
      throw new InvalidSessionDataError(
        `El cargo del asistente no puede superar los ${SESSION_ATTENDEE_POSITION_MAX_LENGTH} caracteres.`,
      );
    }

    normalized.push({
      listMemberId: entry.listMemberId,
      position,
    });
  }

  return normalized;
}
