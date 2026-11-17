export const PROCESS_EXECUTION_STATUSES = [
  'PLANNED',
  'IN_PROGRESS',
  'CONSOLIDATING',
  'PENDING_APPROVAL',
  'CLOSED',
  'VOIDED',
] as const;

export type ProcessExecutionStatus = (typeof PROCESS_EXECUTION_STATUSES)[number];

export const PROCESS_EXECUTION_NAME_MAX = 150;
export const PROCESS_EXECUTION_YEAR_MIN = 2000;
export const PROCESS_EXECUTION_YEAR_MAX = 2100;
