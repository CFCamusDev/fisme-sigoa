import type { ScheduleActivity } from '../entities/schedule-activity.js';

export interface ScheduleActivityRepository {
  findByExecutionId(executionId: string): Promise<ScheduleActivity[]>;
  findByIdForUpdate(id: string): Promise<ScheduleActivity | null>;
  insertMany(activities: readonly ScheduleActivity[]): Promise<void>;
  update(activity: ScheduleActivity): Promise<void>;
  deleteMany(ids: readonly string[]): Promise<void>;
}
