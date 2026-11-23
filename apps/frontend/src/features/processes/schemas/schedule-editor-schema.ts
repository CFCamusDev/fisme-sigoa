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
    const missingFieldPaths = new Set<string>();

    values.activities.forEach((item, index) => {
      const rowNumber = index + 1;
      if (item.indicator.trim().length === 0) {
        missingFieldPaths.add(`activities.${index}.indicator`);
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['activities', index, 'indicator'],
          message: `Indica el indicador de la actividad ${rowNumber}`,
        });
      }
      if (item.startDate.trim().length === 0) {
        missingFieldPaths.add(`activities.${index}.startDate`);
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['activities', index, 'startDate'],
          message: `Indica la fecha de inicio de la actividad ${rowNumber}`,
        });
      }
      if (item.endDate.trim().length === 0) {
        missingFieldPaths.add(`activities.${index}.endDate`);
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['activities', index, 'endDate'],
          message: `Indica la fecha de fin de la actividad ${rowNumber}`,
        });
      }
    });

    const parsed = saveScheduleRequestSchema.safeParse(toSaveScheduleRequest(values));
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        if (missingFieldPaths.has(issue.path.join('.'))) {
          continue;
        }
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: issue.path,
          message: issue.message,
        });
      }
    }
  });
