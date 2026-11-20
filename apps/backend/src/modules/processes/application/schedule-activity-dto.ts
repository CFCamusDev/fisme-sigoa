import {
  scheduleActivityDtoSchema,
  scheduleResponseSchema,
  type ScheduleActivityDto,
  type ScheduleResponse,
} from '@sigoa/shared';
import type { ScheduleActivity } from '../domain/entities/schedule-activity.js';
import { isOverdue } from '../domain/policies/schedule-overdue.js';

export function buildScheduleActivityDto(
  activity: ScheduleActivity,
  today: string,
): ScheduleActivityDto {
  return scheduleActivityDtoSchema.parse({
    id: activity.id,
    processExecutionId: activity.processExecutionId,
    number: activity.number,
    activity: activity.activity,
    responsible: activity.responsible,
    goal: activity.goal,
    indicator: activity.indicator,
    startDate: activity.startDate,
    endDate: activity.endDate,
    status: activity.status,
    actualEndDate: activity.actualEndDate,
    isOverdue: isOverdue(activity, today),
    createdAt: activity.createdAt.toISOString(),
    updatedAt: activity.updatedAt.toISOString(),
  });
}

export function buildScheduleResponse(
  activities: readonly ScheduleActivity[],
  today: string,
): ScheduleResponse {
  return scheduleResponseSchema.parse({
    items: activities.map((activity) => buildScheduleActivityDto(activity, today)),
  });
}
