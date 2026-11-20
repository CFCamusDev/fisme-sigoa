import type { ScheduleChangeableStatusValue } from '@sigoa/shared';

export interface ChangeScheduleActivityStatusCommand {
  readonly actorId: string;
  readonly ip?: string | null;
  readonly activityId: string;
  readonly status: ScheduleChangeableStatusValue;
  readonly actualEndDate?: string;
}
