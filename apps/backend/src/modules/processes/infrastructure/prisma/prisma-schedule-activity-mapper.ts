import type { ScheduleActivity as PrismaScheduleActivityRow } from '../../../../shared/prisma/generated/client.js';
import { ScheduleActivity } from '../../domain/entities/schedule-activity.js';
import type { ScheduleActivityStatus } from '../../domain/entities/schedule-activity-status.js';

export function formatUtcDateToIso(date: Date | null): string | null {
  if (date === null) {
    return null;
  }
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseIsoDateToUtc(isoDate: string | null): Date | null {
  if (isoDate === null) {
    return null;
  }
  return new Date(`${isoDate}T00:00:00.000Z`);
}

export function mapPrismaScheduleActivityRowToDomain(
  row: PrismaScheduleActivityRow,
): ScheduleActivity {
  return ScheduleActivity.rehydrate({
    id: row.id,
    processExecutionId: row.processExecutionId,
    number: row.number,
    activity: row.activity,
    responsible: row.responsible,
    goal: row.goal,
    indicator: row.indicator,
    startDate: formatUtcDateToIso(row.startDate),
    endDate: formatUtcDateToIso(row.endDate),
    status: row.status as ScheduleActivityStatus,
    actualEndDate: formatUtcDateToIso(row.actualEndDate),
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
