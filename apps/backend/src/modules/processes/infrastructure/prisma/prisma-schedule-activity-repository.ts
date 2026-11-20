import type { ScheduleActivity as PrismaScheduleActivityRow } from '../../../../shared/prisma/generated/client.js';
import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type { ScheduleActivity } from '../../domain/entities/schedule-activity.js';
import { InvalidScheduleDataError } from '../../domain/errors/invalid-schedule-data-error.js';
import type { ScheduleActivityRepository } from '../../domain/ports/schedule-activity-repository.js';
import {
  mapPrismaScheduleActivityRowToDomain,
  parseIsoDateToUtc,
} from './prisma-schedule-activity-mapper.js';

function isUniqueViolation(error: unknown): boolean {
  return !!error && typeof error === 'object' && (error as { code?: string }).code === 'P2002';
}

export class PrismaScheduleActivityRepository implements ScheduleActivityRepository {
  constructor(private readonly dbProvider: DbProvider) {}

  async findByExecutionId(executionId: string): Promise<ScheduleActivity[]> {
    const rows = await this.dbProvider.get().scheduleActivity.findMany({
      where: { processExecutionId: executionId },
      orderBy: [{ number: 'asc' }, { id: 'asc' }],
    });

    return rows.map(mapPrismaScheduleActivityRowToDomain);
  }

  async findById(id: string): Promise<ScheduleActivity | null> {
    const row = await this.dbProvider.get().scheduleActivity.findUnique({
      where: { id },
    });

    return row ? mapPrismaScheduleActivityRowToDomain(row) : null;
  }

  async findByIdForUpdate(id: string): Promise<ScheduleActivity | null> {
    const rows = await this.dbProvider.get().$queryRaw<PrismaScheduleActivityRow[]>`
      SELECT
        "id",
        "processExecutionId",
        "number",
        "activity",
        "responsible",
        "goal",
        "indicator",
        "startDate",
        "endDate",
        "status",
        "actualEndDate",
        "createdBy",
        "updatedBy",
        "createdAt",
        "updatedAt"
      FROM "schedule_activities"
      WHERE "id" = ${id}
      FOR UPDATE
    `;

    const row = rows[0];
    return row ? mapPrismaScheduleActivityRowToDomain(row) : null;
  }

  async insertMany(activities: readonly ScheduleActivity[]): Promise<void> {
    if (activities.length === 0) {
      return;
    }

    try {
      await this.dbProvider.get().scheduleActivity.createMany({
        data: activities.map((item) => ({
          id: item.id,
          processExecutionId: item.processExecutionId,
          number: item.number,
          activity: item.activity,
          responsible: item.responsible,
          goal: item.goal,
          indicator: item.indicator,
          startDate: parseIsoDateToUtc(item.startDate),
          endDate: parseIsoDateToUtc(item.endDate),
          status: item.status,
          actualEndDate: parseIsoDateToUtc(item.actualEndDate),
          createdBy: item.createdBy,
          updatedBy: item.updatedBy,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        })),
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new InvalidScheduleDataError(
          'No se puede duplicar el número de actividad dentro del mismo cronograma.',
        );
      }
      throw error;
    }
  }

  async update(activity: ScheduleActivity): Promise<void> {
    try {
      await this.dbProvider.get().scheduleActivity.update({
        where: { id: activity.id },
        data: {
          number: activity.number,
          activity: activity.activity,
          responsible: activity.responsible,
          goal: activity.goal,
          indicator: activity.indicator,
          startDate: parseIsoDateToUtc(activity.startDate),
          endDate: parseIsoDateToUtc(activity.endDate),
          status: activity.status,
          actualEndDate: parseIsoDateToUtc(activity.actualEndDate),
          updatedBy: activity.updatedBy,
          updatedAt: activity.updatedAt,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new InvalidScheduleDataError(
          'No se puede duplicar el número de actividad dentro del mismo cronograma.',
        );
      }
      throw error;
    }
  }

  async deleteMany(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    await this.dbProvider.get().scheduleActivity.deleteMany({
      where: { id: { in: [...ids] } },
    });
  }
}
