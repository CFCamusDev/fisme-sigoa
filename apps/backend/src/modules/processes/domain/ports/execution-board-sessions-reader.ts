export type ExecutionBoardSessionStakeholderType =
  'ADVISORY_BOARD' | 'EMPLOYER' | 'GRADUATE' | 'TEACHER' | 'STUDENT';

export type ExecutionBoardSessionModality = 'VIRTUAL' | 'IN_PERSON' | 'HYBRID';

export interface ExecutionBoardSessionSummaryItem {
  readonly id: string;
  readonly stakeholderType: ExecutionBoardSessionStakeholderType;
  readonly sessionDate: string;
  readonly startTime: string;
  readonly modality: ExecutionBoardSessionModality;
}

export interface ExecutionBoardSessionsSummary {
  readonly total: number;
  readonly lastSessionDate: string | null;
  readonly items: readonly ExecutionBoardSessionSummaryItem[];
}

export interface ExecutionBoardSessionsReader {
  summarize(executionId: string): Promise<ExecutionBoardSessionsSummary>;
}
