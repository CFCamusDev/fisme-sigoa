import type { SessionStakeholderType } from '../entities/session-stakeholder-type.js';

export interface SessionStakeholderListRef {
  readonly id: string;
  readonly type: SessionStakeholderType;
}

export interface SessionStakeholderListReader {
  findById(id: string): Promise<SessionStakeholderListRef | null>;
}
