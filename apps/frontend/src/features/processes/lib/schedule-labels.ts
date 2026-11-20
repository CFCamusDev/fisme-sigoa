import type { ScheduleActivityStatusValue } from '@sigoa/shared';
import type { StatusKey } from '@/lib/status';

export interface ScheduleStatusDisplay {
  readonly statusKey: StatusKey;
  readonly label: string;
}

export const SCHEDULE_ACTIVITY_STATUS_DISPLAY: Record<
  ScheduleActivityStatusValue,
  ScheduleStatusDisplay
> = {
  PENDING: { statusKey: 'PLANNED', label: 'Pendiente' },
  IN_PROGRESS: { statusKey: 'IN_PROGRESS', label: 'En curso' },
  COMPLETED: { statusKey: 'IMPLEMENTED', label: 'Completada' },
};

export const SCHEDULE_OVERDUE_DISPLAY: ScheduleStatusDisplay = {
  statusKey: 'EXPIRED',
  label: 'Vencida',
};
