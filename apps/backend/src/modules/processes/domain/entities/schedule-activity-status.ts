export const SCHEDULE_ACTIVITY_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED'] as const;

export type ScheduleActivityStatus = (typeof SCHEDULE_ACTIVITY_STATUSES)[number];

export const SCHEDULE_ACTIVITY_MAX = 300;
export const SCHEDULE_RESPONSIBLE_MAX = 150;
export const SCHEDULE_GOAL_MAX = 300;
export const SCHEDULE_INDICATOR_MAX = 300;
export const SCHEDULE_YEAR_MIN = 2000;
export const SCHEDULE_YEAR_MAX = 2100;
export const SCHEDULE_MAX_ITEMS = 50;
