import type { SessionModality } from '../entities/session-modality.js';
import type { SessionStakeholderType } from '../entities/session-stakeholder-type.js';

export interface SessionListItem {
  readonly id: string;
  readonly stakeholderType: SessionStakeholderType;
  readonly stakeholderListId: string | null;
  readonly sessionDate: string;
  readonly startTime: string;
  readonly modality: SessionModality;
  readonly meetingUrl: string | null;
  readonly recordingUrl: string | null;
  readonly executionIds: readonly string[];
  readonly attendeeCount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ListSessionsByExecutionParams {
  readonly page: number;
  readonly pageSize: number;
}

export interface ListSessionsByExecutionResult {
  readonly items: readonly SessionListItem[];
  readonly total: number;
}

export interface SessionListRef {
  readonly id: string;
  readonly stakeholderListId: string | null;
}

export interface SessionReader {
  findById(sessionId: string): Promise<SessionListRef | null>;
  listByExecution(
    executionId: string,
    params: ListSessionsByExecutionParams,
  ): Promise<ListSessionsByExecutionResult>;
}
