import { sessionAttendeesResponseSchema, type SessionAttendeesResponse } from '@sigoa/shared';
import type { Attendee } from '../domain/entities/attendee.js';
import type { SessionListMemberRosterItem } from '../domain/ports/session-list-member-reader.js';

export interface BuildSessionAttendeesResponseInput {
  readonly sessionId: string;
  readonly stakeholderListId: string | null;
  readonly roster: readonly SessionListMemberRosterItem[];
  readonly attendees: readonly Attendee[];
}

/**
 * Combines the session Anexo 3 roster with registered attendees into a validated response DTO.
 */
export function buildSessionAttendeesResponse(
  input: BuildSessionAttendeesResponseInput,
): SessionAttendeesResponse {
  const attendeeByMemberId = new Map(
    input.attendees.map((attendee) => [attendee.listMemberId, attendee]),
  );

  return sessionAttendeesResponseSchema.parse({
    sessionId: input.sessionId,
    stakeholderListId: input.stakeholderListId,
    attendeeCount: input.attendees.length,
    items: input.roster.map((member) => {
      const attendee = attendeeByMemberId.get(member.id);
      return {
        listMemberId: member.id,
        fullName: member.fullName,
        institution: member.institution,
        memberPosition: member.position,
        attended: attendee !== undefined,
        position: attendee ? attendee.position : null,
      };
    }),
  });
}
