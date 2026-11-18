import type { SessionListMemberRef } from '../policies/attendee-selection.js';

export interface SessionListMemberRosterItem {
  readonly id: string;
  readonly fullName: string;
  readonly institution: string | null;
  readonly position: string | null;
}

export interface SessionListMemberReader {
  findByIds(ids: readonly string[]): Promise<readonly SessionListMemberRef[]>;
  listByList(listId: string, limit?: number): Promise<readonly SessionListMemberRosterItem[]>;
}
