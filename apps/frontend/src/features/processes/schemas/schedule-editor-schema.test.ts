import { describe, expect, it } from 'vitest';
import { createEmptyFormItem, scheduleEditorFormSchema } from './schedule-editor-schema';

describe('scheduleEditorFormSchema (HU-081, T-081-01)', () => {
  it('reports missing start date and indicator with field messages', () => {
    const first = {
      ...createEmptyFormItem(),
      activity: 'Elaborar cronograma',
      responsible: 'Presidente',
      indicator: '1 cronograma',
      startDate: '2027-03-01',
      endDate: '2027-03-15',
    };
    const second = {
      ...createEmptyFormItem(),
      activity: 'Convocar al Comité Consultivo',
      responsible: 'Secretario',
      indicator: '',
      startDate: '',
      endDate: '',
    };

    const result = scheduleEditorFormSchema.safeParse({ activities: [first, second] });

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      expect(messages).toContainEqual({
        path: 'activities.1.indicator',
        message: 'Indica el indicador de la actividad 2',
      });
      expect(messages).toContainEqual({
        path: 'activities.1.startDate',
        message: 'Indica la fecha de inicio de la actividad 2',
      });
      expect(messages).toContainEqual({
        path: 'activities.1.endDate',
        message: 'Indica la fecha de fin de la actividad 2',
      });
    }
  });

  it('accepts complete activities with valid dates and indicator', () => {
    const valid = {
      ...createEmptyFormItem(),
      activity: 'Elaborar cronograma',
      responsible: 'Presidente',
      indicator: '1 cronograma',
      startDate: '2027-03-01',
      endDate: '2027-03-15',
    };

    const result = scheduleEditorFormSchema.safeParse({ activities: [valid] });
    expect(result.success).toBe(true);
  });
});
