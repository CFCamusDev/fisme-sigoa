import type { RegisterSessionAttendeeEntry } from '@sigoa/shared';

export interface RegisterAttendeesCommand {
  readonly actorId: string;
  readonly ip?: string | null;
  readonly sessionId: string;
  readonly attendees: readonly RegisterSessionAttendeeEntry[];
}
