import type { ScheduleActivityStatus } from '../entities/schedule-activity-status.js';

export const SCHEDULE_TIME_ZONE = 'America/Lima';

const limaDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: SCHEDULE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export interface OverdueCheckable {
  readonly status: ScheduleActivityStatus;
  readonly endDate: string | null;
}

export function todayInLima(now: Date = new Date()): string {
  const parts = limaDateFormatter.formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('No se pudo determinar la fecha civil en America/Lima.');
  }

  return `${year}-${month}-${day}`;
}

export function isOverdue(activity: OverdueCheckable, today: string): boolean {
  if (activity.status === 'COMPLETED' || activity.endDate === null) {
    return false;
  }
  return activity.endDate < today;
}
