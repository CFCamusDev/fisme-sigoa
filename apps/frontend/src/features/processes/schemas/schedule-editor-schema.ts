import {
  saveScheduleRequestSchema,
  type SaveScheduleRequest,
  type ScheduleActivityDto,
  type ScheduleActivityStatusValue,
} from '@sigoa/shared';
import { z } from 'zod';

export interface ScheduleActivityFormItem {
  id?: string;
  activity: string;
  responsible: string;
  goal: string;
  indicator: string;
  startDate: string;
  endDate: string;
  status: ScheduleActivityStatusValue;
  actualEndDate: string | null;
  isOverdue: boolean;
}

export interface ScheduleEditorFormValues {
  activities: ScheduleActivityFormItem[];
}

export function mapDtoToFormItem(dto: ScheduleActivityDto): ScheduleActivityFormItem {
  return {
    id: dto.id,
    activity: dto.activity,
    responsible: dto.responsible,
    goal: dto.goal ?? '',
    indicator: dto.indicator ?? '',
    startDate: dto.startDate ?? '',
    endDate: dto.endDate ?? '',
    status: dto.status,
    actualEndDate: dto.actualEndDate,
    isOverdue: dto.isOverdue,
  };
}

export function createEmptyFormItem(): ScheduleActivityFormItem {
  return {
    activity: '',
    responsible: '',
    goal: '',
    indicator: '',
    startDate: '',
    endDate: '',
    status: 'PENDING',
    actualEndDate: null,
    isOverdue: false,
  };
}

export function toSaveScheduleRequest(values: ScheduleEditorFormValues): SaveScheduleRequest {
  return {
    activities: values.activities.map((item) => ({
      ...(item.id ? { id: item.id } : {}),
      activity: item.activity.trim(),
      responsible: item.responsible.trim(),
      goal: item.goal.trim() || null,
      indicator: item.indicator.trim() || null,
      startDate: item.startDate.trim() || null,
      endDate: item.endDate.trim() || null,
    })),
  };
}

const formItemSchema = z.object({
  id: z.string().optional(),
  activity: z.string(),
  responsible: z.string(),
  goal: z.string(),
  indicator: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED']),
  actualEndDate: z.string().nullable(),
  isOverdue: z.boolean(),
});

export const scheduleEditorFormSchema = z
  .object({
    activities: z.array(formItemSchema),
  })
  .superRefine((values, ctx) => {
    const parsed = saveScheduleRequestSchema.safeParse(toSaveScheduleRequest(values));
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: issue.path,
          message: issue.message,
        });
      }
    }
  });
