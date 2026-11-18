export interface Attendee {
  readonly id: string;
  readonly sessionId: string;
  readonly listMemberId: string;
  readonly position: string | null;
  readonly createdBy: string;
  readonly createdAt: Date;
}

export interface AttendeeSnapshotItem {
  readonly listMemberId: string;
  readonly position: string | null;
}

/**
 * Produces a deterministic, sorted snapshot of session attendees for audit logging and equality checks.
 */
export function snapshotAttendees(
  attendees: readonly Pick<Attendee, 'listMemberId' | 'position'>[],
): AttendeeSnapshotItem[] {
  return [...attendees]
    .sort((a, b) =>
      a.listMemberId < b.listMemberId ? -1 : a.listMemberId > b.listMemberId ? 1 : 0,
    )
    .map((attendee) => ({
      listMemberId: attendee.listMemberId,
      position: attendee.position,
    }));
}
