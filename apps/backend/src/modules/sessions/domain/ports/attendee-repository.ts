import type { Attendee } from '../entities/attendee.js';
import type { NormalizedAttendeeEntry } from '../policies/attendee-selection.js';

export interface ReplaceSessionAttendeesInput {
  readonly sessionId: string;
  readonly entries: readonly NormalizedAttendeeEntry[];
  readonly actorId: string;
  readonly now: Date;
}

export interface AttendeeRepository {
  listBySession(sessionId: string): Promise<readonly Attendee[]>;
  replaceForSession(input: ReplaceSessionAttendeesInput): Promise<readonly Attendee[]>;
  countBySession(sessionId: string): Promise<number>;
}
