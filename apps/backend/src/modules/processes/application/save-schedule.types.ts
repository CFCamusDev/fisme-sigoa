import type { ReconcileScheduleItemInput } from '../domain/policies/schedule-reconciliation.js';

export interface SaveScheduleCommand {
  readonly actorId: string;
  readonly ip?: string | null;
  readonly executionId: string;
  readonly activities: readonly ReconcileScheduleItemInput[];
}
